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
