from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import case, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.excel import xlsx_response
from app.core.money import ZERO, lock_user_for_update, pct_of, to_decimal
from app.core.telegram import send_telegram_message
from app.db.session import get_db
from app.models.attendance import Attendance, AttendanceStatus
from app.models.group import Group, GroupStatus
from app.models.group_schedule import GroupSchedule
from app.models.group_student import GroupStudent, GroupStudentStatus
from app.models.app_state import AppState
from app.models.lesson import Lesson, LessonStatus
from app.models.pending_charge import PendingCharge
from app.models.subject import Subject
from app.models.teacher_transaction import TeacherTransaction, TeacherTransactionType
from app.models.transaction import Transaction, TransactionType
from app.models.user import User, UserRole
from app.schemas.attendance import (
    AttendanceCreate,
    AttendanceDetailOut,
    AttendanceOut,
    AttendanceUpdate,
)
from app.schemas.lesson import LessonCreate, LessonListItemOut, LessonListOut, LessonOut

ATTENDANCE_EDIT_WINDOW = timedelta(hours=24)

ATTENDANCE_STATUS_LABELS = {
    AttendanceStatus.present: "keldi",
    AttendanceStatus.excused: "sababli qoldirdi",
    AttendanceStatus.unexcused: "sababsiz qoldirdi",
}

router = APIRouter(prefix="/api/v1/lessons", tags=["lessons"])


def _attendance_notification_text(
    group_name: str,
    lesson_date,
    status: AttendanceStatus,
    correct_count,
    total_count,
    charged_amount: Optional[float],
    pending_amount: Optional[float] = None,
    is_trial: bool = False,
) -> str:
    lines = [f"{group_name} guruhi, {lesson_date}: {ATTENDANCE_STATUS_LABELS[status]}"]
    if total_count is not None:
        lines.append(f"Test natijasi: {correct_count}/{total_count}")
    if is_trial:
        lines.append("Bu sinov darsi edi, pul yechilmadi.")
    if charged_amount:
        lines.append(f"Balansdan {charged_amount:,.0f} so'm yechildi.")
    if pending_amount:
        lines.append(
            f"Balansingizda {pending_amount:,.0f} so'm uchun mablag' yetarli emas. "
            "Balans to'ldirilgach avtomatik yechiladi."
        )
    return "\n".join(lines)


def _apply_lesson_fee(
    db: Session,
    student: User,
    lesson: Lesson,
    teacher: Optional[User],
    teacher_id: Optional[int],
    teacher_percentage: float,
    lesson_fee: float,
    created_by_id: int,
    comment_suffix: str,
) -> bool:
    """Deducts the full lesson fee from the student's balance (going negative if the
    balance can't cover it), credits the teacher immediately for whatever portion was
    actually available, and queues the uncollected remainder as a PendingCharge.

    Always deducting the full fee (rather than only the collected part) keeps
    student.balance the single source of truth for net debt - no separate bookkeeping
    is needed to know how much a student owes in total.

    Returns True if part of the fee is still pending (uncollected).
    """
    lesson_fee = to_decimal(lesson_fee)
    collected_amount = max(to_decimal(0), min(lesson_fee, to_decimal(student.balance)))
    pending_amount = lesson_fee - collected_amount

    student.balance -= lesson_fee
    db.add(
        Transaction(
            student_id=student.id,
            amount=-lesson_fee,
            type=TransactionType.deduction,
            comment=f"Dars uchun yechim ({comment_suffix})",
            created_by_id=created_by_id,
            lesson_id=lesson.id,
        )
    )

    if teacher is not None and collected_amount > 0:
        immediate_teacher_share = pct_of(collected_amount, teacher_percentage)
        if immediate_teacher_share > 0:
            teacher.balance += immediate_teacher_share
            db.add(
                TeacherTransaction(
                    teacher_id=teacher_id,
                    lesson_id=lesson.id,
                    student_id=student.id,
                    amount=immediate_teacher_share,
                    type=TeacherTransactionType.lesson_earning,
                    comment=f"Dars uchun ({comment_suffix})",
                    created_by_id=created_by_id,
                )
            )

    if pending_amount > 0:
        pending_teacher_share = pct_of(pending_amount, teacher_percentage)
        db.add(
            PendingCharge(
                student_id=student.id,
                lesson_id=lesson.id,
                teacher_id=teacher_id,
                amount=pending_amount,
                original_amount=pending_amount,
                teacher_share=pending_teacher_share,
            )
        )
        return True
    return False


def _reverse_lesson_fee(
    db: Session,
    student: User,
    lesson: Lesson,
    created_by_id: int,
    comment_suffix: str,
) -> None:
    """Undoes everything `_apply_lesson_fee` (or the legacy charging path) did for this
    lesson+student: refunds the full original fee to the student, claws back every
    teacher earning tied to this lesson (including ones credited later via partial
    pending-charge settlements), and drops any still-unresolved PendingCharge.

    Earnings are clawed back from whichever teacher each one was actually credited to
    (`TeacherTransaction.teacher_id`), never from the group's current teacher - a group
    can be reassigned to a different teacher after the lesson was taught, and a
    same-day attendance correction must not take money from that new teacher for a
    lesson they never earned from.
    """
    deductions = (
        db.query(Transaction)
        .filter(
            Transaction.lesson_id == lesson.id,
            Transaction.student_id == student.id,
            Transaction.type == TransactionType.deduction,
        )
        .all()
    )
    refund_amount = sum(-d.amount for d in deductions)
    if refund_amount > 0:
        student.balance += refund_amount
        db.add(
            Transaction(
                student_id=student.id,
                amount=refund_amount,
                type=TransactionType.deposit,
                comment=f"Davomat tuzatildi, pul qaytarildi ({comment_suffix})",
                created_by_id=created_by_id,
                lesson_id=lesson.id,
            )
        )

    earnings = (
        db.query(TeacherTransaction)
        .filter(
            TeacherTransaction.lesson_id == lesson.id,
            TeacherTransaction.student_id == student.id,
            TeacherTransaction.type == TeacherTransactionType.lesson_earning,
        )
        .all()
    )
    shares_by_teacher_id: dict[int, Decimal] = {}
    for earning in earnings:
        shares_by_teacher_id[earning.teacher_id] = (
            shares_by_teacher_id.get(earning.teacher_id, ZERO) + earning.amount
        )

    for teacher_id, total_teacher_share in shares_by_teacher_id.items():
        if total_teacher_share <= 0:
            continue
        teacher = lock_user_for_update(db, teacher_id)
        if teacher is None:
            continue
        teacher.balance -= total_teacher_share
        db.add(
            TeacherTransaction(
                teacher_id=teacher_id,
                lesson_id=lesson.id,
                student_id=student.id,
                amount=-total_teacher_share,
                type=TeacherTransactionType.payout,
                comment=f"Davomat tuzatildi, hisoblangan foiz bekor qilindi ({comment_suffix})",
                created_by_id=created_by_id,
            )
        )

    stale_pending = (
        db.query(PendingCharge)
        .filter(
            PendingCharge.lesson_id == lesson.id,
            PendingCharge.student_id == student.id,
            PendingCharge.resolved_at.is_(None),
        )
        .all()
    )
    for charge in stale_pending:
        db.delete(charge)


def _sync_lesson_charge(
    db: Session,
    lesson: Lesson,
    group: Group,
    student_id: int,
    student: Optional[User],
    teacher: Optional[User],
    teacher_percentage: float,
    should_charge: bool,
    created_by_id: int,
    comment_suffix: str,
) -> bool:
    """Reconciles the money side with whatever attendance status is about to be
    saved, using the same _apply_lesson_fee/_reverse_lesson_fee helpers everywhere
    this is called. Ledger rows are never edited in place - re-marking an
    already-charged lesson with a different status always produces new offsetting
    transactions, so the ledger can never silently drift out of sync with the
    displayed attendance status. A no-op when the existing charge state already
    matches should_charge (e.g. a same-status resubmit, or present<->unexcused).

    Returns True if the student still has an uncollected (pending) portion of the
    fee after this call.
    """
    if student is None:
        return False

    old_deduction = (
        db.query(Transaction)
        .filter(
            Transaction.lesson_id == lesson.id,
            Transaction.student_id == student_id,
            Transaction.type == TransactionType.deduction,
        )
        .first()
    )
    old_pending = (
        db.query(PendingCharge)
        .filter(
            PendingCharge.lesson_id == lesson.id,
            PendingCharge.student_id == student_id,
            PendingCharge.resolved_at.is_(None),
        )
        .first()
    )

    was_charged = old_deduction is not None
    was_pending = old_pending is not None

    if was_pending and not should_charge and not was_charged:
        db.delete(old_pending)

    if was_charged and not should_charge:
        _reverse_lesson_fee(db, student, lesson, created_by_id, comment_suffix)
        return False

    if not was_charged and not was_pending and should_charge:
        return _apply_lesson_fee(
            db,
            student,
            lesson,
            teacher,
            teacher.id if teacher else group.teacher_id,
            teacher_percentage,
            group.lesson_price,
            created_by_id,
            comment_suffix,
        )

    return was_pending


LESSON_AUTO_CREATE_HORIZON = timedelta(days=30)
LESSON_AUTO_CREATE_STATE_KEY = "lesson_auto_create_last_run"


def _auto_create_scheduled_lessons(db: Session) -> None:
    today = date.today()

    state = db.get(AppState, LESSON_AUTO_CREATE_STATE_KEY)
    if state is not None and state.value == today.isoformat():
        return
    if state is None:
        state = AppState(key=LESSON_AUTO_CREATE_STATE_KEY)
        db.add(state)
    state.value = today.isoformat()
    db.commit()

    horizon = today + LESSON_AUTO_CREATE_HORIZON

    schedules = (
        db.query(GroupSchedule, Group)
        .join(Group, Group.id == GroupSchedule.group_id)
        .filter(Group.status == GroupStatus.active)
        .all()
    )
    if not schedules:
        return

    group_ids = {group.id for _, group in schedules}
    existing_dates = {
        (group_id, lesson_date)
        for group_id, lesson_date in db.query(Lesson.group_id, Lesson.lesson_date).filter(
            Lesson.group_id.in_(group_ids),
            Lesson.lesson_date >= today,
            Lesson.lesson_date <= horizon,
        )
    }

    created = False
    for offset in range((horizon - today).days + 1):
        day = today + timedelta(days=offset)
        weekday = day.weekday()
        for schedule, group in schedules:
            if schedule.weekday != weekday:
                continue
            key = (group.id, day)
            if key in existing_dates:
                continue
            db.add(
                Lesson(
                    group_id=group.id,
                    lesson_date=day,
                    start_time=schedule.start_time,
                    end_time=schedule.end_time,
                )
            )
            existing_dates.add(key)
            created = True

    if created:
        try:
            db.commit()
        except IntegrityError:
            # A manually-created lesson could have raced this batch for the same
            # (group_id, day). This runs as a side effect of the lessons list
            # endpoint for any user, so it must never 500 that unrelated request -
            # just drop today's auto-created batch and let the next trigger retry.
            db.rollback()


def _build_lessons_query(
    db: Session,
    current_user: User,
    group_id: Optional[int],
    teacher_id: Optional[int],
    date_from: Optional[date],
    date_to: Optional[date],
    lesson_status: Optional[LessonStatus],
):
    query = (
        db.query(Lesson, Group, Subject)
        .join(Group, Group.id == Lesson.group_id)
        .join(Subject, Subject.id == Group.subject_id)
    )
    if current_user.role == UserRole.teacher:
        query = query.filter(Group.teacher_id == current_user.id)
    elif current_user.role == UserRole.student:
        query = query.join(GroupStudent, GroupStudent.group_id == Lesson.group_id).filter(
            GroupStudent.student_id == current_user.id,
            GroupStudent.status != GroupStudentStatus.dropped,
        )
    elif teacher_id is not None:
        query = query.filter(Group.teacher_id == teacher_id)
    if group_id is not None:
        query = query.filter(Lesson.group_id == group_id)
    if date_from is not None:
        query = query.filter(Lesson.lesson_date >= date_from)
    if date_to is not None:
        query = query.filter(Lesson.lesson_date <= date_to)
    if lesson_status is not None:
        query = query.filter(Lesson.status == lesson_status)
    return query


def _build_lesson_items(db: Session, rows: list) -> list[LessonListItemOut]:
    lesson_ids = [lesson.id for lesson, _, _ in rows]

    counts: dict[int, dict[AttendanceStatus, int]] = {}
    if lesson_ids:
        count_rows = (
            db.query(Attendance.lesson_id, Attendance.status, func.count(Attendance.id))
            .filter(Attendance.lesson_id.in_(lesson_ids))
            .group_by(Attendance.lesson_id, Attendance.status)
            .all()
        )
        for lesson_id, att_status, count in count_rows:
            counts.setdefault(lesson_id, {})[att_status] = count

    teacher_ids = {group.teacher_id for _, group, _ in rows}
    teachers = {u.id: u.full_name for u in db.query(User).filter(User.id.in_(teacher_ids))} if teacher_ids else {}

    return [
        LessonListItemOut(
            id=lesson.id,
            group_id=group.id,
            group_name=group.name,
            subject_name=subject.name,
            teacher_id=group.teacher_id,
            teacher_name=teachers.get(group.teacher_id, ""),
            lesson_date=lesson.lesson_date,
            start_time=lesson.start_time,
            end_time=lesson.end_time,
            status=lesson.status,
            present_count=counts.get(lesson.id, {}).get(AttendanceStatus.present, 0),
            excused_count=counts.get(lesson.id, {}).get(AttendanceStatus.excused, 0),
            unexcused_count=counts.get(lesson.id, {}).get(AttendanceStatus.unexcused, 0),
        )
        for lesson, group, subject in rows
    ]


def _lesson_order_expression():
    status_order = case(
        (Lesson.status == LessonStatus.planned, 0),
        (Lesson.status == LessonStatus.completed, 1),
        else_=2,
    )
    planned_date_order = case(
        (Lesson.status == LessonStatus.planned, Lesson.lesson_date),
    ).asc()
    completed_date_order = case(
        (Lesson.status == LessonStatus.completed, Lesson.lesson_date),
    ).desc()
    return (status_order, planned_date_order, completed_date_order)


@router.get("", response_model=LessonListOut)
def list_all_lessons(
    group_id: Optional[int] = Query(default=None),
    teacher_id: Optional[int] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    lesson_status: Optional[LessonStatus] = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.teacher, UserRole.student)
    ),
):
    _auto_create_scheduled_lessons(db)

    query = _build_lessons_query(
        db, current_user, group_id, teacher_id, date_from, date_to, lesson_status
    )

    total = query.count()
    completed_count = query.filter(Lesson.status == LessonStatus.completed).count()
    planned_count = query.filter(Lesson.status == LessonStatus.planned).count()

    rows = (
        query.order_by(*_lesson_order_expression())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = _build_lesson_items(db, rows)
    return LessonListOut(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        completed_count=completed_count,
        planned_count=planned_count,
    )


LESSON_STATUS_LABELS = {LessonStatus.planned: "Rejada", LessonStatus.completed: "O'tildi"}


@router.get("/export")
def export_lessons(
    group_id: Optional[int] = Query(default=None),
    teacher_id: Optional[int] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    lesson_status: Optional[LessonStatus] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.teacher, UserRole.student)
    ),
):
    query = _build_lessons_query(
        db, current_user, group_id, teacher_id, date_from, date_to, lesson_status
    )
    rows = query.order_by(*_lesson_order_expression()).all()
    items = _build_lesson_items(db, rows)
    xlsx_rows = [
        [
            item.lesson_date,
            f"{item.start_time.strftime('%H:%M')}-{item.end_time.strftime('%H:%M')}"
            if item.start_time and item.end_time
            else "",
            item.group_name,
            item.subject_name,
            item.teacher_name,
            LESSON_STATUS_LABELS.get(item.status, item.status.value),
            item.present_count,
            item.excused_count,
            item.unexcused_count,
        ]
        for item in items
    ]
    return xlsx_response(
        "darslar.xlsx",
        [
            "Sana",
            "Vaqt",
            "Guruh",
            "Fan",
            "O'qituvchi",
            "Holat",
            "Keldi",
            "Sababli",
            "Sababsiz",
        ],
        xlsx_rows,
    )


@router.post("", response_model=LessonOut, status_code=status.HTTP_201_CREATED)
def create_lesson(
    payload: LessonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    group = db.get(Group, payload.group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Guruh topilmadi")
    if group.status != GroupStatus.active:
        raise HTTPException(
            status_code=400, detail="Faol bo'lmagan guruh uchun dars ochib bo'lmaydi"
        )

    existing = (
        db.query(Lesson)
        .filter(Lesson.group_id == payload.group_id, Lesson.lesson_date == payload.lesson_date)
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=400, detail="Bu guruh uchun shu sanada dars allaqachon mavjud"
        )

    lesson = Lesson(group_id=payload.group_id, lesson_date=payload.lesson_date)
    db.add(lesson)
    try:
        db.commit()
    except IntegrityError:
        # Closes the race a pre-check alone can't: two near-simultaneous requests
        # (double-click, slow-network retry) both passing the check above.
        db.rollback()
        raise HTTPException(
            status_code=400, detail="Bu guruh uchun shu sanada dars allaqachon mavjud"
        )
    db.refresh(lesson)
    return lesson


@router.delete("/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lesson(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    lesson = db.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Dars topilmadi")

    has_attendance = (
        db.query(Attendance).filter(Attendance.lesson_id == lesson_id).first() is not None
    )
    if lesson.status != LessonStatus.planned or has_attendance:
        raise HTTPException(
            status_code=400,
            detail="Davomat olingan darsni o'chirib bo'lmaydi",
        )

    db.delete(lesson)
    db.commit()


@router.get("/{lesson_id}/attendance", response_model=list[AttendanceDetailOut])
def get_lesson_attendance(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.teacher)
    ),
):
    lesson = db.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Dars topilmadi")

    group = db.get(Group, lesson.group_id)
    if current_user.role == UserRole.teacher and group.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu guruh sizga biriktirilmagan")

    rows = (
        db.query(Attendance, User)
        .join(User, User.id == Attendance.student_id)
        .filter(Attendance.lesson_id == lesson.id)
        .all()
    )
    return [
        AttendanceDetailOut(
            id=att.id,
            lesson_id=att.lesson_id,
            student_id=att.student_id,
            student_name=student.full_name,
            status=att.status,
            correct_count=att.correct_count,
            total_count=att.total_count,
            is_trial=att.is_trial,
        )
        for att, student in rows
    ]


@router.post(
    "/{lesson_id}/attendance",
    response_model=list[AttendanceOut],
    status_code=status.HTTP_201_CREATED,
)
def mark_attendance(
    lesson_id: int,
    payload: AttendanceCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.teacher)),
):
    lesson = db.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Dars topilmadi")

    group = db.get(Group, lesson.group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Guruh topilmadi")
    if group.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu guruh sizga biriktirilmagan")

    teacher_user = lock_user_for_update(db, group.teacher_id)
    teacher_percentage = (
        teacher_user.teacher_percentage if teacher_user else 0.0
    ) or 0.0

    created_records: list[Attendance] = []

    for item in payload.records:
        group_student = (
            db.query(GroupStudent)
            .filter(
                GroupStudent.group_id == group.id,
                GroupStudent.student_id == item.student_id,
            )
            .first()
        )
        if group_student is None:
            raise HTTPException(
                status_code=404,
                detail=f"O'quvchi {item.student_id} ushbu guruhda topilmadi",
            )

        if item.status != AttendanceStatus.present and item.total_count is not None:
            raise HTTPException(
                status_code=400, detail="Test natijasi faqat kelgan o'quvchiga kiritiladi"
            )

        is_frozen = group_student.status == GroupStudentStatus.frozen
        should_charge = (
            item.status in (AttendanceStatus.present, AttendanceStatus.unexcused)
            and not is_frozen
            and not item.is_trial
        )

        # Lock the student row BEFORE reading/writing any ledger rows below, so a
        # concurrent resubmit for the same student+lesson serializes here instead of
        # both requests racing on the same "not charged yet" read.
        student = lock_user_for_update(db, item.student_id)

        existing_att = (
            db.query(Attendance)
            .filter(
                Attendance.lesson_id == lesson.id,
                Attendance.student_id == item.student_id,
            )
            .first()
        )

        if existing_att is not None:
            existing_att.status = item.status
            existing_att.correct_count = item.correct_count
            existing_att.total_count = item.total_count
            existing_att.is_trial = item.is_trial
            created_records.append(existing_att)
        else:
            attendance = Attendance(
                lesson_id=lesson.id,
                student_id=item.student_id,
                status=item.status,
                correct_count=item.correct_count,
                total_count=item.total_count,
                is_trial=item.is_trial,
            )
            db.add(attendance)
            created_records.append(attendance)

        # Reconciles Transaction/PendingCharge/TeacherTransaction with should_charge
        # via new offsetting entries - a no-op if the ledger already matches (e.g. a
        # same-status resubmit), a reversal if this used to be charged and no longer
        # should be, or a fresh charge if it's newly chargeable. Never edits an old
        # ledger row in place.
        is_pending = _sync_lesson_charge(
            db,
            lesson,
            group,
            item.student_id,
            student,
            teacher_user,
            teacher_percentage,
            should_charge,
            current_user.id,
            f"{group.name}, {lesson.lesson_date}",
        )

        if student is not None and student.telegram_chat_id:
            background_tasks.add_task(
                send_telegram_message,
                student.telegram_chat_id,
                _attendance_notification_text(
                    group.name,
                    lesson.lesson_date,
                    item.status,
                    item.correct_count,
                    item.total_count,
                    group.lesson_price if should_charge and not is_pending else None,
                    group.lesson_price if is_pending else None,
                    item.is_trial,
                ),
            )

    lesson.status = LessonStatus.completed
    db.commit()
    for record in created_records:
        db.refresh(record)
    return created_records


@router.put("/{lesson_id}/attendance/{student_id}", response_model=AttendanceOut)
def update_attendance(
    lesson_id: int,
    student_id: int,
    payload: AttendanceUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.teacher)),
):
    lesson = db.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Dars topilmadi")

    group = db.get(Group, lesson.group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Guruh topilmadi")
    if group.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu guruh sizga biriktirilmagan")

    attendance = (
        db.query(Attendance)
        .filter(Attendance.lesson_id == lesson_id, Attendance.student_id == student_id)
        .first()
    )
    if attendance is None:
        raise HTTPException(status_code=404, detail="Bu o'quvchi uchun davomat topilmadi")

    created_at = attendance.created_at
    if created_at is not None and created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    if created_at is None or datetime.now(timezone.utc) - created_at > ATTENDANCE_EDIT_WINDOW:
        raise HTTPException(
            status_code=403,
            detail="Davomat belgilangandan 24 soat o'tdi, endi uni tuzatib bo'lmaydi",
        )

    if payload.status != AttendanceStatus.present and payload.total_count is not None:
        raise HTTPException(
            status_code=400, detail="Test natijasi faqat kelgan o'quvchiga kiritiladi"
        )

    group_student = (
        db.query(GroupStudent)
        .filter(GroupStudent.group_id == group.id, GroupStudent.student_id == student_id)
        .first()
    )
    is_frozen = group_student is not None and group_student.status == GroupStudentStatus.frozen

    # Lock the student/teacher rows BEFORE reading old_deduction/old_pending below, so a
    # second concurrent correction request blocks here (on Postgres) until the first one
    # commits, instead of both requests reading the "not charged yet" state and double-
    # charging the student.
    student = lock_user_for_update(db, student_id)
    teacher = lock_user_for_update(db, group.teacher_id)

    should_charge = (
        payload.status in (AttendanceStatus.present, AttendanceStatus.unexcused)
        and not is_frozen
        and not payload.is_trial
    )
    teacher_percentage = (teacher.teacher_percentage or 0.0) if teacher else 0.0

    # Reconciles Transaction/PendingCharge/TeacherTransaction with should_charge via
    # new offsetting entries - never edits an old ledger row in place.
    _sync_lesson_charge(
        db,
        lesson,
        group,
        student_id,
        student,
        teacher,
        teacher_percentage,
        should_charge,
        current_user.id,
        f"davomat tuzatildi, {group.name}, {lesson.lesson_date}",
    )

    attendance.status = payload.status
    attendance.correct_count = payload.correct_count
    attendance.total_count = payload.total_count
    attendance.is_trial = payload.is_trial
    db.commit()
    db.refresh(attendance)

    if student is not None and student.telegram_chat_id:
        background_tasks.add_task(
            send_telegram_message,
            student.telegram_chat_id,
            "Davomat tuzatildi.\n"
            + _attendance_notification_text(
                group.name,
                lesson.lesson_date,
                payload.status,
                payload.correct_count,
                payload.total_count,
                group.lesson_price if should_charge else None,
                None,
                payload.is_trial,
            ),
        )

    return attendance
