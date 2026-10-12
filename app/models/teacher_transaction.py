import enum

from sqlalchemy import Column, Integer, Float, ForeignKey, Enum, DateTime
from sqlalchemy.sql import func

from app.db.session import Base


class TeacherTransactionType(str, enum.Enum):
    lesson_earning = "lesson_earning"
    payout = "payout"


class TeacherTransaction(Base):
    __tablename__ = "teacher_transactions"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=True)
    amount = Column(Float, nullable=False)
    type = Column(Enum(TeacherTransactionType), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
