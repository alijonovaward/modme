from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.user import PasswordUpdate, UserCreate, UserOut

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_staff_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin)),
):
    if payload.role == UserRole.superadmin:
        raise HTTPException(status_code=400, detail="Superadmin shu yo'l orqali yaratilmaydi")
    if payload.role == UserRole.teacher and payload.teacher_percentage is None:
        raise HTTPException(status_code=400, detail="O'qituvchi uchun foiz stavkasi kiritilishi shart")
    if payload.role != UserRole.teacher and payload.teacher_percentage is not None:
        raise HTTPException(status_code=400, detail="Foiz stavkasi faqat o'qituvchiga tegishli")

    existing = db.query(User).filter(User.phone == payload.phone).first()
    if existing is not None:
        raise HTTPException(status_code=400, detail="Bu telefon raqam allaqachon ro'yxatdan o'tgan")

    user = User(
        full_name=payload.full_name,
        phone=payload.phone,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        teacher_percentage=payload.teacher_percentage,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}/password", response_model=UserOut)
def update_user_password(
    user_id: int,
    payload: PasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    db.refresh(user)
    return user
