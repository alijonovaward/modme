from datetime import time
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.group import GroupStatus
from app.models.group_student import GroupStudentStatus


class GroupScheduleItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    weekday: int = Field(ge=0, le=6)
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def _check_time_range(self) -> "GroupScheduleItem":
        if self.end_time <= self.start_time:
            raise ValueError("Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak")
        return self


class GroupCreate(BaseModel):
    name: str
    subject_id: int
    teacher_id: int
    lesson_price: float
    schedule: list[GroupScheduleItem] = []


class GroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    subject_id: int
    teacher_id: int
    lesson_price: float
    status: GroupStatus
    schedule: list[GroupScheduleItem] = []


class GroupStatusUpdate(BaseModel):
    status: GroupStatus


class GroupStudentCreate(BaseModel):
    student_id: int


class GroupStudentStatusUpdate(BaseModel):
    status: GroupStudentStatus
    reason: Optional[str] = None


class GroupStudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    student_id: int
    status: GroupStudentStatus
    status_reason: Optional[str] = None


class GroupListItemOut(BaseModel):
    id: int
    name: str
    subject_id: int
    subject_name: str
    teacher_id: int
    teacher_name: str
    lesson_price: float
    status: GroupStatus
    schedule: list[GroupScheduleItem] = []


class GroupRosterItemOut(BaseModel):
    id: int
    student_id: int
    student_name: str
    student_phone: str
    status: GroupStudentStatus
    status_reason: Optional[str] = None


class GroupDetailOut(GroupListItemOut):
    students: list[GroupRosterItemOut]
