import enum

from sqlalchemy import Column, Integer, ForeignKey, Enum, Date

from app.db.session import Base


class LessonStatus(str, enum.Enum):
    planned = "planned"
    completed = "completed"


class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    lesson_date = Column(Date, nullable=False)
    status = Column(Enum(LessonStatus), default=LessonStatus.planned, nullable=False)
