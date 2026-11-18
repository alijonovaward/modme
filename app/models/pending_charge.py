from sqlalchemy import Column, DateTime, Numeric, ForeignKey, Integer
from sqlalchemy.sql import func

from app.db.session import Base


class PendingCharge(Base):
    __tablename__ = "pending_charges"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    amount = Column(Numeric(14, 0), nullable=False)
    original_amount = Column(Numeric(14, 0), nullable=True)
    teacher_share = Column(Numeric(14, 0), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
