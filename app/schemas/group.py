from datetime import date, time
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.attendance import AttendanceStatus
from app.models.group import GroupStatus
from app.models.group_student import GroupStudentStatus
from app.models.lesson import LessonStatus


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


class StudentAttendanceStatsOut(BaseModel):
    student_id: int
    student_name: str
    total_lessons: int
    attendance_rate: float
    recent_attendance_rate: Optional[float] = None
    previous_attendance_rate: Optional[float] = None
    is_declining: bool


class StudentGroupStatsOut(BaseModel):
    group_id: int
    group_name: str
    subject_name: str
    teacher_name: str
    status: GroupStudentStatus
    attendance_rate: float
    total_spent: float


class AttendanceGridLessonOut(BaseModel):
    id: int
    lesson_date: date
    status: LessonStatus


class AttendanceGridStudentOut(BaseModel):
    student_id: int
    student_name: str


class AttendanceGridCellOut(BaseModel):
    student_id: int
    lesson_id: int
    status: AttendanceStatus
    is_trial: bool


class AttendanceGridOut(BaseModel):
    lessons: list[AttendanceGridLessonOut]
    students: list[AttendanceGridStudentOut]
    cells: list[AttendanceGridCellOut]
