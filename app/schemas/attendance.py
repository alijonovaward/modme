from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.attendance import AttendanceStatus


class AttendanceItem(BaseModel):
    student_id: int
    status: AttendanceStatus
    grade: Optional[int] = None

    @field_validator("grade")
    @classmethod
    def validate_grade(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (1 <= v <= 5):
            raise ValueError("grade 1 dan 5 gacha bo'lishi kerak")
        return v


class AttendanceCreate(BaseModel):
    records: list[AttendanceItem]


class AttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    lesson_id: int
    student_id: int
    status: AttendanceStatus
    grade: Optional[int] = None


class AttendanceDetailOut(BaseModel):
    id: int
    lesson_id: int
    student_id: int
    student_name: str
    status: AttendanceStatus
    grade: Optional[int] = None


class StudentAttendanceHistoryItemOut(BaseModel):
    id: int
    lesson_id: int
    lesson_date: date
    group_id: int
    group_name: str
    status: AttendanceStatus
    grade: Optional[int] = None
