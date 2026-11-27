import enum

from sqlalchemy import Boolean, Column, Integer, String, Float, Numeric, DateTime, Enum, ForeignKey
from sqlalchemy.sql import func

from app.db.session import Base


class UserRole(str, enum.Enum):
    superadmin = "superadmin"
    admin = "admin"
    teacher = "teacher"
    student = "student"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    phone = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    teacher_percentage = Column(Float, nullable=True)
    balance = Column(Numeric(14, 0), default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    telegram_chat_id = Column(String, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # Soft delete: distinct from is_active (which also covers a plain, reversible
    # block). A deleted user always has is_active=False too, but not every blocked
    # user is deleted - deleted_at marks the stronger, "hide from every list" state.
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    # Login lockout: counts consecutive wrong-password attempts, reset to 0 on a
    # successful login. Once it hits the threshold (see app/routers/auth.py),
    # locked_until is set and login is refused - without even checking the
    # password - until that time passes.
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)
