from datetime import date, time
from typing import Optional

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.lesson import LessonStatus


class LessonCreate(BaseModel):
    group_id: int
    lesson_date: date


class LessonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    lesson_date: date
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    status: LessonStatus


class LessonListItemOut(BaseModel):
    id: int
    group_id: int
    group_name: str
    subject_name: str
    teacher_id: int
    teacher_name: str
    lesson_date: date
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    status: LessonStatus
    present_count: int
    excused_count: int
    unexcused_count: int


class LessonGenerateRequest(BaseModel):
    date_from: date
    date_to: date

    @model_validator(mode="after")
    def _check_range(self) -> "LessonGenerateRequest":
        if self.date_to < self.date_from:
            raise ValueError("Tugash sanasi boshlanish sanasidan keyin bo'lishi kerak")
        if (self.date_to - self.date_from).days > 366:
            raise ValueError("Sana oralig'i 366 kundan oshmasligi kerak")
        return self


class LessonGenerateResult(BaseModel):
    created_count: int
    skipped_count: int
    lessons: list[LessonOut]


class LessonListOut(BaseModel):
    items: list[LessonListItemOut]
    total: int
    page: int
    page_size: int
    completed_count: int
    planned_count: int
