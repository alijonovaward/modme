import enum

from sqlalchemy import Column, Integer, String, Float, DateTime, Enum
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
    balance = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
