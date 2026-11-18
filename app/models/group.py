import enum

from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, Enum

from app.db.session import Base


class GroupStatus(str, enum.Enum):
    active = "active"
    frozen = "frozen"
    archived = "archived"


class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    lesson_price = Column(Numeric(14, 0), nullable=False)
    status = Column(Enum(GroupStatus), default=GroupStatus.active, nullable=False)
