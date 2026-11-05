import re
from datetime import datetime
from typing import Annotated, Optional

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, computed_field

from app.models.user import UserRole

PHONE_PATTERN = re.compile(r"^\+998\d{9}$")


def _validate_phone(value: str) -> str:
    if not PHONE_PATTERN.fullmatch(value):
        raise ValueError("Telefon raqam +998XXXXXXXXX formatida bo'lishi kerak")
    return value


Phone = Annotated[str, AfterValidator(_validate_phone)]


class UserCreate(BaseModel):
    full_name: str
    phone: Phone
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
    is_active: bool
    created_at: datetime
    telegram_chat_id: Optional[str] = Field(default=None, exclude=True)

    @computed_field
    @property
    def telegram_linked(self) -> bool:
        return bool(self.telegram_chat_id)


class PasswordUpdate(BaseModel):
    new_password: str


class StudentUpdate(BaseModel):
    full_name: str
    phone: Phone


class StaffUpdate(BaseModel):
    full_name: str
    phone: Phone
    teacher_percentage: Optional[float] = None


class ActiveStatusUpdate(BaseModel):
    is_active: bool


class StudentListOut(BaseModel):
    items: list[UserOut]
    total: int
    page: int
    page_size: int
    debtor_count: int


class StaffListOut(BaseModel):
    items: list[UserOut]
    total: int
    page: int
    page_size: int


class LoginRequest(BaseModel):
    phone: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
