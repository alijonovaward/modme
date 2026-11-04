from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.user import (
    ActiveStatusUpdate,
    PasswordUpdate,
    StaffListOut,
    StaffUpdate,
    UserCreate,
    UserOut,
)

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.get("/users", response_model=StaffListOut)
def list_staff_users(
    role: Optional[UserRole] = Query(default=None),
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    query = db.query(User).filter(User.role != UserRole.student)
    if role is not None:
        query = query.filter(User.role == role)
    if search:
        term = f"%{search}%"
        query = query.filter(or_(User.full_name.ilike(term), User.phone.ilike(term)))

    total = query.count()
    items = (
        query.order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return StaffListOut(items=items, total=total, page=page, page_size=page_size)


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


@router.put("/users/{user_id}", response_model=UserOut)
def update_staff_user(
    user_id: int,
    payload: StaffUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin)),
):
    user = db.get(User, user_id)
    if user is None or user.role == UserRole.student:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    if user.role == UserRole.teacher and payload.teacher_percentage is None:
        raise HTTPException(status_code=400, detail="O'qituvchi uchun foiz stavkasi kiritilishi shart")
    if user.role != UserRole.teacher and payload.teacher_percentage is not None:
        raise HTTPException(status_code=400, detail="Foiz stavkasi faqat o'qituvchiga tegishli")

    existing = (
        db.query(User)
        .filter(User.phone == payload.phone, User.id != user.id)
        .first()
    )
    if existing is not None:
        raise HTTPException(status_code=400, detail="Bu telefon raqam allaqachon ro'yxatdan o'tgan")

    user.full_name = payload.full_name
    user.phone = payload.phone
    if user.role == UserRole.teacher:
        user.teacher_percentage = payload.teacher_percentage
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}/status", response_model=UserOut)
def update_staff_status(
    user_id: int,
    payload: ActiveStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin)),
):
    user = db.get(User, user_id)
    if user is None or user.role == UserRole.student:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="O'zingizni bloklay olmaysiz")

    user.is_active = payload.is_active
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
    if current_user.role == UserRole.admin and user.role in (UserRole.admin, UserRole.superadmin):
        raise HTTPException(
            status_code=403, detail="Admin boshqa adminning yoki superadminning parolini o'zgartira olmaydi"
        )
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    db.refresh(user)
    return user
