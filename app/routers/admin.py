from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.excel import xlsx_response
from app.core.security import hash_password
from app.db.session import get_db
from app.models.group import Group, GroupStatus
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

ROLE_LABELS = {
    UserRole.superadmin: "Bosh administrator",
    UserRole.admin: "Administrator",
    UserRole.teacher: "O'qituvchi",
}


def _build_staff_query(
    db: Session, role: Optional[UserRole], search: Optional[str], show_deleted: bool = False
):
    query = db.query(User).filter(User.role != UserRole.student)
    query = query.filter(User.deleted_at.isnot(None)) if show_deleted else query.filter(
        User.deleted_at.is_(None)
    )
    if role is not None:
        query = query.filter(User.role == role)
    if search:
        term = f"%{search}%"
        query = query.filter(or_(User.full_name.ilike(term), User.phone.ilike(term)))
    return query


@router.get("/users", response_model=StaffListOut)
def list_staff_users(
    role: Optional[UserRole] = Query(default=None),
    search: Optional[str] = Query(default=None),
    show_deleted: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    query = _build_staff_query(db, role, search, show_deleted)

    total = query.count()
    items = (
        query.order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return StaffListOut(items=items, total=total, page=page, page_size=page_size)


@router.get("/users/export")
def export_staff_users(
    role: Optional[UserRole] = Query(default=None),
    search: Optional[str] = Query(default=None),
    show_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    staff = _build_staff_query(db, role, search, show_deleted).order_by(User.created_at.desc()).all()
    rows = [
        [
            u.full_name,
            u.phone,
            ROLE_LABELS.get(u.role, u.role.value),
            u.teacher_percentage if u.teacher_percentage is not None else "",
            "O'chirilgan" if u.deleted_at is not None else ("Faol" if u.is_active else "Bloklangan"),
        ]
        for u in staff
    ]
    return xlsx_response(
        "xodimlar.xlsx", ["F.I.O", "Telefon", "Lavozim", "Foiz", "Holat"], rows
    )


def _check_phone_available(db: Session, phone: str, exclude_id: Optional[int] = None) -> None:
    """Raises 400 if `phone` is already taken. A phone that belongs to a soft-deleted
    row can't just be reused for a new signup (the DB's unique constraint would still
    reject it) - so this surfaces that as a distinct, actionable message instead of
    the generic "already registered" one, since the right fix is usually to restore
    the old record rather than create a duplicate.
    """
    query = db.query(User).filter(User.phone == phone)
    if exclude_id is not None:
        query = query.filter(User.id != exclude_id)
    existing = query.first()
    if existing is None:
        return
    if existing.deleted_at is not None:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Bu telefon raqam oldin o'chirilgan '{existing.full_name}' ismli yozuvga tegishli. "
                "Agar bu o'sha odam bo'lsa, uni tiklang (ro'yxatda \"O'chirilganlar\" filtri orqali "
                "topiladi), aks holda boshqa raqam kiriting."
            ),
        )
    raise HTTPException(status_code=400, detail="Bu telefon raqam allaqachon ro'yxatdan o'tgan")


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

    _check_phone_available(db, payload.phone)

    user = User(
        full_name=payload.full_name,
        phone=payload.phone,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        teacher_percentage=payload.teacher_percentage,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # Closes the race a pre-check alone can't: two near-simultaneous requests
        # with the same new phone number both passing the check above.
        db.rollback()
        raise HTTPException(status_code=400, detail="Bu telefon raqam allaqachon ro'yxatdan o'tgan")
    db.refresh(user)
    return user


@router.get("/users/{user_id}", response_model=UserOut)
def get_staff_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    # Deliberately ignores deleted_at - a detail page must still be able to open a
    # deleted staff member (e.g. to restore them), even though the list view hides them.
    user = db.get(User, user_id)
    if user is None or user.role == UserRole.student:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
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

    _check_phone_available(db, payload.phone, exclude_id=user.id)

    user.full_name = payload.full_name
    user.phone = payload.phone
    if user.role == UserRole.teacher:
        user.teacher_percentage = payload.teacher_percentage
    db.commit()
    db.refresh(user)
    return user


def _freeze_active_groups(db: Session, teacher: User) -> None:
    """Freezes every group the teacher actively teaches, so lesson/attendance
    creation stops too. Used whenever a teacher is blocked or deleted. Reactivating/
    restoring does NOT auto-unfreeze, same as with students."""
    active_groups = (
        db.query(Group)
        .filter(Group.teacher_id == teacher.id, Group.status == GroupStatus.active)
        .all()
    )
    for group in active_groups:
        group.status = GroupStatus.frozen


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
    if user.role == UserRole.superadmin:
        raise HTTPException(status_code=403, detail="Bosh administratorni bloklay olmaysiz")
    if user.deleted_at is not None:
        raise HTTPException(
            status_code=400, detail="O'chirilgan xodimni bloklash/faollashtirish mumkin emas"
        )

    user.is_active = payload.is_active

    if user.role == UserRole.teacher and not payload.is_active:
        # Mirrors the student block flow: blocking a teacher stops their own
        # account but says nothing about the groups they teach.
        _freeze_active_groups(db, user)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", response_model=UserOut)
def delete_staff_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin)),
):
    """Soft-deletes a teacher/admin: distinct from blocking (`/status`). A deleted
    staff member is also blocked (is_active=False), but is additionally hidden from
    every staff list and search. The row itself is never removed, so existing
    ledger history (commissions, payouts) keeps resolving their name correctly.
    """
    user = db.get(User, user_id)
    if user is None or user.role == UserRole.student:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="O'zingizni o'chira olmaysiz")
    if user.role == UserRole.superadmin:
        raise HTTPException(status_code=403, detail="Bosh administratorni o'chira olmaysiz")
    if user.deleted_at is not None:
        raise HTTPException(status_code=400, detail="Xodim allaqachon o'chirilgan")

    user.deleted_at = datetime.now(timezone.utc)
    user.deleted_by_id = current_user.id
    user.is_active = False

    if user.role == UserRole.teacher:
        _freeze_active_groups(db, user)

    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}/restore", response_model=UserOut)
def restore_staff_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin)),
):
    """Undoes a delete: clears deleted_at/deleted_by_id so the staff member reappears
    in lists and search. Does NOT also reactivate the account (is_active stays False)
    - that's a separate, deliberate step via `/status`."""
    user = db.get(User, user_id)
    if user is None or user.role == UserRole.student:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
    if user.deleted_at is None:
        raise HTTPException(status_code=400, detail="Xodim o'chirilmagan")

    user.deleted_at = None
    user.deleted_by_id = None
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
