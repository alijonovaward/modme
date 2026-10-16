from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.security import hash_password
from app.db.session import get_db
from app.models.attendance import Attendance, AttendanceStatus
from app.models.group import Group
from app.models.lesson import Lesson
from app.models.transaction import Transaction, TransactionType
from app.models.user import User, UserRole
from app.schemas.attendance import StudentAttendanceHistoryItemOut
from app.schemas.transaction import DepositCreate, StudentTransactionListItemOut, TransactionOut
from app.schemas.user import UserCreate, UserOut

router = APIRouter(prefix="/api/v1/students", tags=["students"])


@router.get("", response_model=list[UserOut])
def list_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    return (
        db.query(User)
        .filter(User.role == UserRole.student)
        .order_by(User.created_at.desc())
        .all()
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


@router.post("/{student_id}/deposit", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def deposit_to_student(
    student_id: int,
    payload: DepositCreate,
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
    return transaction


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

    if current_user.role == UserRole.student and current_user.id != student.id:
        raise HTTPException(status_code=403, detail="Faqat o'z tarixingizni ko'rishingiz mumkin")

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

    rows = query.order_by(Transaction.created_at.desc()).all()

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

    if current_user.role == UserRole.student and current_user.id != student.id:
        raise HTTPException(status_code=403, detail="Faqat o'z tarixingizni ko'rishingiz mumkin")

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
