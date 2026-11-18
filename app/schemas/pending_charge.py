from datetime import date as date_type, datetime
from typing import Optional

from pydantic import BaseModel


class StudentPendingChargeOut(BaseModel):
    id: int
    lesson_id: int
    group_name: str
    subject_name: str
    teacher_name: str
    lesson_date: date_type
    amount: float
    original_amount: Optional[float] = None
    created_at: datetime
