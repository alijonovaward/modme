from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.transaction import TransactionType
from app.models.teacher_transaction import TeacherTransactionType


class DepositCreate(BaseModel):
    amount: float
    comment: Optional[str] = None


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    amount: float
    type: TransactionType
    comment: Optional[str] = None
    created_at: datetime


class TransactionListItemOut(BaseModel):
    id: int
    student_id: int
    student_name: str
    amount: float
    type: TransactionType
    comment: Optional[str] = None
    created_at: datetime
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None
    group_id: Optional[int] = None
    group_name: Optional[str] = None
    lesson_date: Optional[date] = None


class TeacherPayoutCreate(BaseModel):
    amount: float
    comment: Optional[str] = None


class TeacherTransactionListItemOut(BaseModel):
    id: int
    teacher_id: int
    amount: float
    type: TeacherTransactionType
    comment: Optional[str] = None
    created_at: datetime
    student_name: Optional[str] = None
    group_name: Optional[str] = None
    lesson_date: Optional[date] = None


class TeacherTransactionGlobalListItemOut(BaseModel):
    id: int
    teacher_id: int
    teacher_name: str
    student_id: Optional[int] = None
    student_name: Optional[str] = None
    amount: float
    type: TeacherTransactionType
    comment: Optional[str] = None
    created_at: datetime
    group_id: Optional[int] = None
    group_name: Optional[str] = None
    lesson_date: Optional[date] = None
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None
