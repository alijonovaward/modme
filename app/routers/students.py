from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.excel import xlsx_response
from app.core.security import hash_password
from app.core.telegram import send_telegram_message
from app.db.session import get_db
from app.models.attendance import Attendance, AttendanceStatus
from app.models.group import Group
from app.models.lesson import Lesson
from app.models.transaction import Transaction, TransactionType
from app.models.user import User, UserRole
from app.schemas.attendance import StudentAttendanceHistoryItemOut
from app.schemas.transaction import DepositCreate, StudentTransactionListItemOut, TransactionOut
from app.schemas.user import ActiveStatusUpdate, StudentListOut, StudentUpdate, UserCreate, UserOut

router = APIRouter(prefix="/api/v1/students", tags=["students"])


def _build_students_query(db: Session, search: Optional[str], debtors_only: bool):
    query = db.query(User).filter(User.role == UserRole.student)
    if search:
        term = f"%{search}%"
        query = query.filter(or_(User.full_name.ilike(term), User.phone.ilike(term)))
    if debtors_only:
        query = query.filter(User.balance < 0)
    return query


@router.get("", response_model=StudentListOut)
def list_students(
    search: Optional[str] = Query(default=None),
    debtors_only: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    query = _build_students_query(db, search, debtors_only)

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
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    students = _build_students_query(db, search, debtors_only).order_by(User.created_at.desc()).all()
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


@router.post("/{student_id}/deposit", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def deposit_to_student(
    student_id: int,
    payload: DepositCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Summa musbat bo'lishi kerak")

    student = _get_student_or_404(db, student_id)

    transaction = Transaction(
        student_id=student.id,
        amount=payload.amount,
        type=TransactionType.deposit,
        comment=payload.comment,
        created_by_id=current_user.id,
    )
    student.balance += payload.amount
    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    if student.telegram_chat_id:
        background_tasks.add_task(
            send_telegram_message,
            student.telegram_chat_id,
            f"Balansingiz {payload.amount:,.0f} so'mga to'ldirildi. "
            f"Joriy balans: {student.balance:,.0f} so'm",
        )

    return transaction


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

    rows = query.order_by(Lesson.lesson_date.desc()).all()

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
            grade=attendance.grade,
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
        [lesson.lesson_date, group.name, teacher.full_name, attendance.status.value, attendance.grade]
        for attendance, lesson, group, teacher in rows
    ]
    return xlsx_response(
        f"{student.full_name}_davomati.xlsx",
        ["Sana", "Guruh", "O'qituvchi", "Holat", "Baho"],
        xlsx_rows,
    )
