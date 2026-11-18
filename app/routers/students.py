from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.excel import xlsx_response
from app.core.idempotency import (
    IdempotencyInProgress,
    abort_idempotent_request,
    begin_idempotent_request,
    finish_idempotent_request,
)
from app.core.money import ZERO, lock_user_for_update, round_som, to_decimal
from app.core.security import hash_password
from app.core.telegram import send_telegram_message
from app.db.session import get_db
from app.models.attendance import Attendance, AttendanceStatus
from app.models.group import Group
from app.models.group_student import GroupStudent
from app.models.lesson import Lesson, LessonStatus
from app.models.pending_charge import PendingCharge
from app.models.subject import Subject
from app.models.teacher_transaction import TeacherTransaction, TeacherTransactionType
from app.models.transaction import Transaction, TransactionType
from app.models.user import User, UserRole
from app.schemas.attendance import StudentAttendanceHistoryItemOut
from app.schemas.group import StudentGroupStatsOut
from app.schemas.pending_charge import StudentPendingChargeOut
from app.schemas.transaction import DepositCreate, StudentTransactionListItemOut, TransactionOut
from app.schemas.user import ActiveStatusUpdate, StudentListOut, StudentUpdate, UserCreate, UserOut

router = APIRouter(prefix="/api/v1/students", tags=["students"])


def _build_students_query(
    db: Session, search: Optional[str], debtors_only: bool, group_id: Optional[int] = None
):
    query = db.query(User).filter(User.role == UserRole.student)
    if search:
        term = f"%{search}%"
        query = query.filter(or_(User.full_name.ilike(term), User.phone.ilike(term)))
    if debtors_only:
        query = query.filter(User.balance < 0)
    if group_id is not None:
        query = query.filter(
            User.id.in_(
                db.query(GroupStudent.student_id).filter(GroupStudent.group_id == group_id)
            )
        )
    return query


@router.get("", response_model=StudentListOut)
def list_students(
    search: Optional[str] = Query(default=None),
    debtors_only: bool = Query(default=False),
    group_id: Optional[int] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    query = _build_students_query(db, search, debtors_only, group_id)

    total = query.count()
    debtor_count = (
        db.query(User).filter(User.role == UserRole.student, User.balance < 0).count()
    )
    items = (
        query.order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return StudentListOut(items=items, total=total, page=page, page_size=page_size, debtor_count=debtor_count)


@router.get("/export")
def export_students(
    search: Optional[str] = Query(default=None),
    debtors_only: bool = Query(default=False),
    group_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    students = (
        _build_students_query(db, search, debtors_only, group_id)
        .order_by(User.created_at.desc())
        .all()
    )
    rows = [
        [s.full_name, s.phone, s.balance, "Faol" if s.is_active else "Bloklangan"]
        for s in students
    ]
    return xlsx_response(
        "oquvchilar.xlsx", ["F.I.O", "Telefon", "Balans", "Holat"], rows
    )


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_student(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    if payload.role != UserRole.student:
        raise HTTPException(status_code=400, detail="Ushbu endpoint faqat o'quvchi qo'shish uchun")

    existing = db.query(User).filter(User.phone == payload.phone).first()
    if existing is not None:
        raise HTTPException(status_code=400, detail="Bu telefon raqam allaqachon ro'yxatdan o'tgan")

    student = User(
        full_name=payload.full_name,
        phone=payload.phone,
        hashed_password=hash_password(payload.password),
        role=UserRole.student,
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


def _get_student_or_404(db: Session, student_id: int) -> User:
    student = db.get(User, student_id)
    if student is None or student.role != UserRole.student:
        raise HTTPException(status_code=404, detail="O'quvchi topilmadi")
    return student


@router.put("/{student_id}", response_model=UserOut)
def update_student(
    student_id: int,
    payload: StudentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    student = _get_student_or_404(db, student_id)

    existing = (
        db.query(User)
        .filter(User.phone == payload.phone, User.id != student.id)
        .first()
    )
    if existing is not None:
        raise HTTPException(status_code=400, detail="Bu telefon raqam allaqachon ro'yxatdan o'tgan")

    student.full_name = payload.full_name
    student.phone = payload.phone
    db.commit()
    db.refresh(student)
    return student


@router.put("/{student_id}/status", response_model=UserOut)
def update_student_status(
    student_id: int,
    payload: ActiveStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    student = _get_student_or_404(db, student_id)
    student.is_active = payload.is_active
    db.commit()
    db.refresh(student)
    return student


def _settle_pending_charges(db: Session, student: User, deposit_amount) -> list[PendingCharge]:
    deposit_amount = to_decimal(deposit_amount)
    if deposit_amount <= 0:
        return []

    pending = (
        db.query(PendingCharge)
        .filter(PendingCharge.student_id == student.id, PendingCharge.resolved_at.is_(None))
        .order_by(PendingCharge.created_at.asc())
        .with_for_update()
        .all()
    )
    settled: list[PendingCharge] = []
    remaining_deposit = deposit_amount

    for charge in pending:
        if remaining_deposit <= 0:
            break

        pay_amount = min(remaining_deposit, charge.amount)

        if charge.amount > 0 and charge.teacher_share > 0:
            teacher_pay_share = round_som(charge.teacher_share * (pay_amount / charge.amount))
        else:
            teacher_pay_share = ZERO

        teacher = lock_user_for_update(db, charge.teacher_id)
        if teacher is not None and teacher_pay_share > 0:
            teacher.balance += teacher_pay_share
            db.add(
                TeacherTransaction(
                    teacher_id=charge.teacher_id,
                    lesson_id=charge.lesson_id,
                    student_id=student.id,
                    amount=teacher_pay_share,
                    type=TeacherTransactionType.lesson_earning,
                    comment=f"Qarz dars uchun qisman to'lov tushdi ({pay_amount:,.0f} so'm)",
                )
            )

        charge.amount -= pay_amount
        charge.teacher_share -= teacher_pay_share
        remaining_deposit -= pay_amount

        if charge.amount <= 0:
            charge.amount = ZERO
            charge.teacher_share = ZERO
            charge.resolved_at = datetime.now(timezone.utc)
            settled.append(charge)

    return settled


@router.post("/{student_id}/deposit", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def deposit_to_student(
    student_id: int,
    payload: DepositCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
):
    try:
        replay = begin_idempotent_request(db, "students.deposit", idempotency_key)
    except IdempotencyInProgress:
        raise HTTPException(
            status_code=409, detail="So'rov hali bajarilmoqda, biroz kutib qayta urinib ko'ring"
        )
    if replay is not None:
        return JSONResponse(status_code=replay.status_code, content=replay.body)

    if payload.amount <= 0:
        abort_idempotent_request(db, idempotency_key)
        raise HTTPException(status_code=400, detail="Summa musbat bo'lishi kerak")

    amount = round_som(payload.amount)

    try:
        student = _get_student_or_404(db, student_id)
        student = lock_user_for_update(db, student.id) or student

        transaction = Transaction(
            student_id=student.id,
            amount=amount,
            type=TransactionType.deposit,
            comment=payload.comment,
            created_by_id=current_user.id,
        )
        student.balance += amount
        db.add(transaction)

        settled = _settle_pending_charges(db, student, amount)

        db.commit()
        db.refresh(transaction)
    except Exception:
        abort_idempotent_request(db, idempotency_key)
        raise

    if student.telegram_chat_id:
        message = (
            f"Balansingiz {amount:,.0f} so'mga to'ldirildi. "
            f"Joriy balans: {student.balance:,.0f} so'm"
        )
        if settled:
            total_settled = sum(c.amount for c in settled)
            message += (
                f"\nOldin kutilgan {len(settled)} ta dars uchun {total_settled:,.0f} so'm "
                "avtomatik yechildi."
            )
        background_tasks.add_task(send_telegram_message, student.telegram_chat_id, message)

    result = TransactionOut.model_validate(transaction)
    finish_idempotent_request(db, idempotency_key, status.HTTP_201_CREATED, result)
    return result


def _build_student_transactions_query(
    db: Session,
    student: User,
    group_id: Optional[int],
    type: Optional[TransactionType],
    date_from: Optional[datetime],
    date_to: Optional[datetime],
):
    query = (
        db.query(Transaction, Lesson, Group, User)
        .outerjoin(Lesson, Lesson.id == Transaction.lesson_id)
        .outerjoin(Group, Group.id == Lesson.group_id)
        .outerjoin(User, User.id == Group.teacher_id)
        .filter(Transaction.student_id == student.id)
    )
    if group_id is not None:
        query = query.filter(Group.id == group_id)
    if type is not None:
        query = query.filter(Transaction.type == type)
    if date_from is not None:
        query = query.filter(Transaction.created_at >= date_from)
    if date_to is not None:
        query = query.filter(Transaction.created_at <= date_to)
    return query


def _require_own_history_or_staff(current_user: User, student: User) -> None:
    if current_user.role == UserRole.student and current_user.id != student.id:
        raise HTTPException(status_code=403, detail="Faqat o'z tarixingizni ko'rishingiz mumkin")


@router.get("/{student_id}/groups", response_model=list[StudentGroupStatsOut])
def get_student_groups(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.student)
    ),
):
    student = _get_student_or_404(db, student_id)
    _require_own_history_or_staff(current_user, student)

    rows = (
        db.query(GroupStudent, Group, Subject, User)
        .join(Group, Group.id == GroupStudent.group_id)
        .join(Subject, Subject.id == Group.subject_id)
        .join(User, User.id == Group.teacher_id)
        .filter(GroupStudent.student_id == student.id)
        .order_by(Group.name)
        .all()
    )

    results: list[StudentGroupStatsOut] = []
    for group_student, group, subject, teacher in rows:
        att_counts = dict(
            db.query(Attendance.status, func.count(Attendance.id))
            .join(Lesson, Lesson.id == Attendance.lesson_id)
            .filter(Lesson.group_id == group.id, Attendance.student_id == student.id)
            .group_by(Attendance.status)
            .all()
        )
        present = att_counts.get(AttendanceStatus.present, 0)
        excused = att_counts.get(AttendanceStatus.excused, 0)
        unexcused = att_counts.get(AttendanceStatus.unexcused, 0)
        total_marked = present + excused + unexcused
        attendance_rate = round(present / total_marked * 100, 1) if total_marked else 0.0

        total_spent = abs(
            db.query(func.sum(Transaction.amount))
            .join(Lesson, Lesson.id == Transaction.lesson_id)
            .filter(
                Transaction.student_id == student.id,
                Transaction.type == TransactionType.deduction,
                Lesson.group_id == group.id,
            )
            .scalar()
            or 0.0
        )

        results.append(
            StudentGroupStatsOut(
                group_id=group.id,
                group_name=group.name,
                subject_name=subject.name,
                teacher_name=teacher.full_name,
                status=group_student.status,
                attendance_rate=attendance_rate,
                total_spent=total_spent,
            )
        )
    return results


@router.get("/{student_id}/pending-charges", response_model=list[StudentPendingChargeOut])
def get_student_pending_charges(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.student)
    ),
):
    student = _get_student_or_404(db, student_id)
    _require_own_history_or_staff(current_user, student)

    rows = (
        db.query(PendingCharge, Lesson, Group, Subject, User)
        .join(Lesson, Lesson.id == PendingCharge.lesson_id)
        .join(Group, Group.id == Lesson.group_id)
        .join(Subject, Subject.id == Group.subject_id)
        .join(User, User.id == PendingCharge.teacher_id)
        .filter(PendingCharge.student_id == student.id, PendingCharge.resolved_at.is_(None))
        .order_by(PendingCharge.created_at.asc())
        .all()
    )

    return [
        StudentPendingChargeOut(
            id=charge.id,
            lesson_id=lesson.id,
            group_name=group.name,
            subject_name=subject.name,
            teacher_name=teacher.full_name,
            lesson_date=lesson.lesson_date,
            amount=charge.amount,
            original_amount=getattr(charge, "original_amount", None) or charge.amount,
            created_at=charge.created_at,
        )
        for charge, lesson, group, subject, teacher in rows
    ]


@router.get("/{student_id}/transactions", response_model=list[StudentTransactionListItemOut])
def get_student_transactions(
    student_id: int,
    group_id: Optional[int] = Query(default=None),
    type: Optional[TransactionType] = Query(default=None),
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.student)
    ),
):
    student = _get_student_or_404(db, student_id)
    _require_own_history_or_staff(current_user, student)

    rows = (
        _build_student_transactions_query(db, student, group_id, type, date_from, date_to)
        .order_by(Transaction.created_at.desc())
        .all()
    )

    return [
        StudentTransactionListItemOut(
            id=t.id,
            amount=t.amount,
            type=t.type,
            comment=t.comment,
            created_at=t.created_at,
            group_id=group.id if group else None,
            group_name=group.name if group else None,
            teacher_name=teacher.full_name if teacher else None,
            lesson_date=lesson.lesson_date if lesson else None,
        )
        for t, lesson, group, teacher in rows
    ]


@router.get("/{student_id}/transactions/export")
def export_student_transactions(
    student_id: int,
    group_id: Optional[int] = Query(default=None),
    type: Optional[TransactionType] = Query(default=None),
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.student)
    ),
):
    student = _get_student_or_404(db, student_id)
    _require_own_history_or_staff(current_user, student)

    rows = (
        _build_student_transactions_query(db, student, group_id, type, date_from, date_to)
        .order_by(Transaction.created_at.desc())
        .all()
    )
    xlsx_rows = [
        [
            t.created_at,
            t.type.value,
            t.amount,
            group.name if group else "",
            teacher.full_name if teacher else "",
            lesson.lesson_date if lesson else None,
            t.comment or "",
        ]
        for t, lesson, group, teacher in rows
    ]
    return xlsx_response(
        f"{student.full_name}_tranzaksiyalari.xlsx",
        ["Sana", "Turi", "Summa", "Guruh", "O'qituvchi", "Dars sanasi", "Izoh"],
        xlsx_rows,
    )


def _student_attendance_rows(
    db: Session,
    student: User,
    current_user: User,
    group_id: Optional[int],
    status_filter: Optional[AttendanceStatus],
    date_from: Optional[date],
    date_to: Optional[date],
):
    query = (
        db.query(Attendance, Lesson, Group, User)
        .join(Lesson, Lesson.id == Attendance.lesson_id)
        .join(Group, Group.id == Lesson.group_id)
        .join(User, User.id == Group.teacher_id)
        .filter(Attendance.student_id == student.id)
    )
    if group_id is not None:
        query = query.filter(Group.id == group_id)
    if status_filter is not None:
        query = query.filter(Attendance.status == status_filter)
    if date_from is not None:
        query = query.filter(Lesson.lesson_date >= date_from)
    if date_to is not None:
        query = query.filter(Lesson.lesson_date <= date_to)

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
    rows = query.order_by(status_order, planned_date_order, completed_date_order).all()

    if current_user.role == UserRole.teacher:
        rows = [row for row in rows if row[2].teacher_id == current_user.id]
    return rows


@router.get("/{student_id}/attendance", response_model=list[StudentAttendanceHistoryItemOut])
def get_student_attendance_history(
    student_id: int,
    group_id: Optional[int] = Query(default=None),
    status_filter: Optional[AttendanceStatus] = Query(default=None, alias="status"),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.teacher, UserRole.student)
    ),
):
    student = _get_student_or_404(db, student_id)
    _require_own_history_or_staff(current_user, student)

    rows = _student_attendance_rows(
        db, student, current_user, group_id, status_filter, date_from, date_to
    )

    return [
        StudentAttendanceHistoryItemOut(
            id=attendance.id,
            lesson_id=lesson.id,
            lesson_date=lesson.lesson_date,
            group_id=group.id,
            group_name=group.name,
            teacher_name=teacher.full_name,
            status=attendance.status,
            correct_count=attendance.correct_count,
            total_count=attendance.total_count,
            is_trial=attendance.is_trial,
        )
        for attendance, lesson, group, teacher in rows
    ]


@router.get("/{student_id}/attendance/export")
def export_student_attendance(
    student_id: int,
    group_id: Optional[int] = Query(default=None),
    status_filter: Optional[AttendanceStatus] = Query(default=None, alias="status"),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.teacher, UserRole.student)
    ),
):
    student = _get_student_or_404(db, student_id)
    _require_own_history_or_staff(current_user, student)

    rows = _student_attendance_rows(
        db, student, current_user, group_id, status_filter, date_from, date_to
    )
    xlsx_rows = [
        [
            lesson.lesson_date,
            group.name,
            teacher.full_name,
            attendance.status.value,
            f"{attendance.correct_count}/{attendance.total_count}"
            if attendance.total_count is not None
            else "",
            "Ha" if attendance.is_trial else "",
        ]
        for attendance, lesson, group, teacher in rows
    ]
    return xlsx_response(
        f"{student.full_name}_davomati.xlsx",
        ["Sana", "Guruh", "O'qituvchi", "Holat", "Test natijasi", "Sinov darsi"],
        xlsx_rows,
    )
