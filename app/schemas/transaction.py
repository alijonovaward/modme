from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.transaction import TransactionType


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
