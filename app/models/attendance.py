import enum

from sqlalchemy import Column, DateTime, Integer, ForeignKey, Enum
from sqlalchemy.sql import func

from app.db.session import Base


class AttendanceStatus(str, enum.Enum):
    present = "present"
    excused = "excused"
    unexcused = "unexcused"


class Attendance(Base):
    __tablename__ = "attendances"

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(AttendanceStatus), nullable=False)
    grade = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
