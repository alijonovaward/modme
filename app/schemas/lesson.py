from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.lesson import LessonStatus


class LessonCreate(BaseModel):
    group_id: int
    lesson_date: date


class LessonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    lesson_date: date
    status: LessonStatus


class LessonListItemOut(BaseModel):
    id: int
    group_id: int
    group_name: str
    subject_name: str
    teacher_id: int
    teacher_name: str
    lesson_date: date
    status: LessonStatus
    present_count: int
    excused_count: int
    unexcused_count: int
