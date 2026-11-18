from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.excel import xlsx_response
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
        db.commit()


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
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.teacher)
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
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.teacher)
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

    lesson = Lesson(group_id=payload.group_id, lesson_date=payload.lesson_date)
    db.add(lesson)
    db.commit()
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
    current_user: User = Depends(
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.teacher)
    ),
):
    lesson = db.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Dars topilmadi")

    group = db.get(Group, lesson.group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Guruh topilmadi")
    if current_user.role == UserRole.teacher and group.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu guruh sizga biriktirilmagan")

    teacher_user = (
        current_user
        if current_user.role == UserRole.teacher
        else db.get(User, group.teacher_id)
    )
    teacher_percentage = (
        teacher_user.teacher_percentage if teacher_user else 0.0
    ) or 0.0
    teacher_id = teacher_user.id if teacher_user else group.teacher_id

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
            continue

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

        is_frozen = group_student.status == GroupStudentStatus.frozen
        should_charge = (
            item.status in (AttendanceStatus.present, AttendanceStatus.unexcused)
            and not is_frozen
            and not item.is_trial
        )

        student = db.get(User, item.student_id)
        is_pending = False

        already_charged = (
            db.query(Transaction)
            .filter(
                Transaction.lesson_id == lesson.id,
                Transaction.student_id == item.student_id,
                Transaction.type == TransactionType.deduction,
            )
            .first()
            is not None
        ) or (
            db.query(PendingCharge)
            .filter(
                PendingCharge.lesson_id == lesson.id,
                PendingCharge.student_id == item.student_id,
            )
            .first()
            is not None
        )

        if should_charge and student is not None and not already_charged:
            teacher_share = group.lesson_price * (teacher_percentage / 100)
            if student.balance >= group.lesson_price:
                student.balance -= group.lesson_price
                db.add(
                    Transaction(
                        student_id=student.id,
                        amount=-group.lesson_price,
                        type=TransactionType.deduction,
                        comment=(
                            f"Dars uchun yechim ({group.name}, {lesson.lesson_date})"
                        ),
                        created_by_id=current_user.id,
                        lesson_id=lesson.id,
                    )
                )

                if teacher_user is not None:
                    teacher_user.balance += teacher_share
                    db.add(
                        TeacherTransaction(
                            teacher_id=teacher_id,
                            lesson_id=lesson.id,
                            student_id=item.student_id,
                            amount=teacher_share,
                            type=TeacherTransactionType.lesson_earning,
                        )
                    )
            else:
                is_pending = True
                db.add(
                    PendingCharge(
                        student_id=item.student_id,
                        lesson_id=lesson.id,
                        teacher_id=teacher_id,
                        amount=group.lesson_price,
                        teacher_share=teacher_share,
                    )
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
    current_user: User = Depends(
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.teacher)
    ),
):
    lesson = db.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Dars topilmadi")

    group = db.get(Group, lesson.group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Guruh topilmadi")
    if current_user.role == UserRole.teacher and group.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu guruh sizga biriktirilmagan")

    attendance = (
        db.query(Attendance)
        .filter(Attendance.lesson_id == lesson_id, Attendance.student_id == student_id)
        .first()
    )
    if attendance is None:
        raise HTTPException(status_code=404, detail="Bu o'quvchi uchun davomat topilmadi")

    if current_user.role == UserRole.teacher:
        created_at = attendance.created_at
        if created_at is not None and created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if created_at is None or datetime.now(timezone.utc) - created_at > ATTENDANCE_EDIT_WINDOW:
            raise HTTPException(
                status_code=403,
                detail="Davomat belgilangandan 24 soat o'tgan, endi faqat admin tuzatishi mumkin",
            )

    if payload.status == AttendanceStatus.present and payload.total_count is None:
        raise HTTPException(
            status_code=400, detail="Kelgan o'quvchiga test natijasi kiritilishi shart"
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

    old_deduction = (
        db.query(Transaction)
        .filter(
            Transaction.lesson_id == lesson_id,
            Transaction.student_id == student_id,
            Transaction.type == TransactionType.deduction,
        )
        .first()
    )
    old_earning = (
        db.query(TeacherTransaction)
        .filter(
            TeacherTransaction.lesson_id == lesson_id,
            TeacherTransaction.student_id == student_id,
            TeacherTransaction.type == TeacherTransactionType.lesson_earning,
        )
        .first()
    )
    old_pending = (
        db.query(PendingCharge)
        .filter(
            PendingCharge.lesson_id == lesson_id,
            PendingCharge.student_id == student_id,
            PendingCharge.resolved_at.is_(None),
        )
        .first()
    )

    was_charged = old_deduction is not None
    was_pending = old_pending is not None
    should_charge = (
        payload.status in (AttendanceStatus.present, AttendanceStatus.unexcused)
        and not is_frozen
        and not payload.is_trial
    )

    student = db.get(User, student_id)
    teacher = db.get(User, group.teacher_id)

    if was_pending and not should_charge:
        db.delete(old_pending)
    elif was_charged and not should_charge:
        student.balance += group.lesson_price
        db.add(
            Transaction(
                student_id=student_id,
                amount=group.lesson_price,
                type=TransactionType.deposit,
                comment=f"Davomat tuzatildi, pul qaytarildi ({group.name}, {lesson.lesson_date})",
                created_by_id=current_user.id,
                lesson_id=lesson.id,
            )
        )
        refund_share = old_earning.amount if old_earning else 0.0
        if refund_share:
            teacher.balance -= refund_share
            db.add(
                TeacherTransaction(
                    teacher_id=teacher.id,
                    lesson_id=lesson.id,
                    student_id=student_id,
                    amount=-refund_share,
                    type=TeacherTransactionType.payout,
                    comment=(
                        f"Davomat tuzatildi, hisoblangan foiz bekor qilindi "
                        f"({group.name}, {lesson.lesson_date})"
                    ),
                    created_by_id=current_user.id,
                )
            )
    elif not was_charged and not was_pending and should_charge:
        teacher_share = group.lesson_price * ((teacher.teacher_percentage or 0.0) / 100)
        if student.balance >= group.lesson_price:
            student.balance -= group.lesson_price
            db.add(
                Transaction(
                    student_id=student_id,
                    amount=-group.lesson_price,
                    type=TransactionType.deduction,
                    comment=f"Davomat tuzatildi, dars uchun yechildi ({group.name}, {lesson.lesson_date})",
                    created_by_id=current_user.id,
                    lesson_id=lesson.id,
                )
            )
            teacher.balance += teacher_share
            db.add(
                TeacherTransaction(
                    teacher_id=teacher.id,
                    lesson_id=lesson.id,
                    student_id=student_id,
                    amount=teacher_share,
                    type=TeacherTransactionType.lesson_earning,
                    comment=f"Davomat tuzatildi ({group.name}, {lesson.lesson_date})",
                    created_by_id=current_user.id,
                )
            )
        else:
            db.add(
                PendingCharge(
                    student_id=student_id,
                    lesson_id=lesson.id,
                    teacher_id=teacher.id,
                    amount=group.lesson_price,
                    teacher_share=teacher_share,
                )
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
