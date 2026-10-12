from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.user import UserRole


class UserCreate(BaseModel):
    full_name: str
    phone: str
    password: str
    role: UserRole
    teacher_percentage: Optional[float] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    phone: str
    role: UserRole
    teacher_percentage: Optional[float] = None
    balance: float
    created_at: datetime


class PasswordUpdate(BaseModel):
    new_password: str


class LoginRequest(BaseModel):
    phone: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
