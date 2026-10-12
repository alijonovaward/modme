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
