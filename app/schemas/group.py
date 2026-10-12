from pydantic import BaseModel, ConfigDict

from app.models.group import GroupStatus
from app.models.group_student import GroupStudentStatus


class GroupCreate(BaseModel):
    name: str
    subject_id: int
    teacher_id: int
    lesson_price: float


class GroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    subject_id: int
    teacher_id: int
    lesson_price: float
    status: GroupStatus


class GroupStudentCreate(BaseModel):
    student_id: int


class GroupStudentStatusUpdate(BaseModel):
    status: GroupStudentStatus


class GroupStudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    student_id: int
    status: GroupStudentStatus


class GroupListItemOut(BaseModel):
    id: int
    name: str
    subject_id: int
    subject_name: str
    teacher_id: int
    teacher_name: str
    lesson_price: float
    status: GroupStatus


class GroupRosterItemOut(BaseModel):
    id: int
    student_id: int
    student_name: str
    student_phone: str
    status: GroupStudentStatus


class GroupDetailOut(GroupListItemOut):
    students: list[GroupRosterItemOut]
