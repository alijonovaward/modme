from datetime import date as date_type, datetime

from pydantic import BaseModel


class StudentPendingChargeOut(BaseModel):
    id: int
    lesson_id: int
    group_name: str
    subject_name: str
    teacher_name: str
    lesson_date: date_type
    amount: float
    created_at: datetime
