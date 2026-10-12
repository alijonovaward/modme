from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.teacher_transaction import TeacherTransactionType


class TeacherTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    teacher_id: int
    amount: float
    type: TeacherTransactionType
    created_at: datetime


class TeacherFinanceFilter(BaseModel):
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    group_id: Optional[int] = None
