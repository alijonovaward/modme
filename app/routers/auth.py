from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import Token, UserOut

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

MAX_FAILED_LOGIN_ATTEMPTS = 5
LOGIN_LOCKOUT_DURATION = timedelta(minutes=15)


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone == form_data.username).first()

    if user is not None and user.locked_until is not None:
        locked_until = user.locked_until
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if locked_until > datetime.now(timezone.utc):
            minutes_left = max(1, int((locked_until - datetime.now(timezone.utc)).total_seconds() // 60) + 1)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Juda ko'p noto'g'ri urinish. {minutes_left} daqiqadan keyin qayta urinib ko'ring",
            )

    if not user or not verify_password(form_data.password, user.hashed_password):
        if user is not None:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
                user.locked_until = datetime.now(timezone.utc) + LOGIN_LOCKOUT_DURATION
                user.failed_login_attempts = 0
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telefon raqam yoki parol noto'g'ri",
        )

    if user.failed_login_attempts or user.locked_until:
        user.failed_login_attempts = 0
        user.locked_until = None
        db.commit()

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hisobingiz bloklangan, administratorga murojaat qiling",
        )
    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return Token(access_token=access_token)


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
