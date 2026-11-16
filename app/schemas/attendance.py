from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.attendance import AttendanceStatus


def _validate_test_result(correct_count: Optional[int], total_count: Optional[int]) -> None:
    if (correct_count is None) != (total_count is None):
        raise ValueError("Test natijasi uchun to'g'ri va jami savollar soni birga kiritilishi kerak")
    if correct_count is not None and total_count is not None:
        if total_count <= 0:
            raise ValueError("Jami savollar soni musbat bo'lishi kerak")
        if correct_count < 0 or correct_count > total_count:
            raise ValueError("To'g'ri javoblar soni 0 dan jami savollar sonigacha bo'lishi kerak")


class AttendanceItem(BaseModel):
    student_id: int
    status: AttendanceStatus
    correct_count: Optional[int] = None
    total_count: Optional[int] = None

    @model_validator(mode="after")
    def validate_test_result(self) -> "AttendanceItem":
        _validate_test_result(self.correct_count, self.total_count)
        return self


class AttendanceCreate(BaseModel):
    records: list[AttendanceItem]


class AttendanceUpdate(BaseModel):
    status: AttendanceStatus
    correct_count: Optional[int] = None
    total_count: Optional[int] = None

    @model_validator(mode="after")
    def validate_test_result(self) -> "AttendanceUpdate":
        _validate_test_result(self.correct_count, self.total_count)
        return self


class AttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    lesson_id: int
    student_id: int
    status: AttendanceStatus
    correct_count: Optional[int] = None
    total_count: Optional[int] = None


class AttendanceDetailOut(BaseModel):
    id: int
    lesson_id: int
    student_id: int
    student_name: str
    status: AttendanceStatus
    correct_count: Optional[int] = None
    total_count: Optional[int] = None


class StudentAttendanceHistoryItemOut(BaseModel):
    id: int
    lesson_id: int
    lesson_date: date
    group_id: int
    group_name: str
    teacher_name: str
    status: AttendanceStatus
    correct_count: Optional[int] = None
    total_count: Optional[int] = None
