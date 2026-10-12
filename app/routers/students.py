from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.security import hash_password
from app.db.session import get_db
from app.models.transaction import Transaction, TransactionType
from app.models.user import User, UserRole
from app.schemas.transaction import DepositCreate, TransactionOut
from app.schemas.user import UserCreate, UserOut

router = APIRouter(prefix="/api/v1/students", tags=["students"])


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
    )
    student.balance += payload.amount
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


@router.get("/{student_id}/transactions", response_model=list[TransactionOut])
def get_student_transactions(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.student)
    ),
):
    student = _get_student_or_404(db, student_id)

    if current_user.role == UserRole.student and current_user.id != student.id:
        raise HTTPException(status_code=403, detail="Faqat o'z tarixingizni ko'rishingiz mumkin")

    return (
        db.query(Transaction)
        .filter(Transaction.student_id == student.id)
        .order_by(Transaction.created_at.desc())
        .all()
    )
