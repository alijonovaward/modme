import enum

from sqlalchemy import Column, Integer, String, ForeignKey, Enum

from app.db.session import Base


class GroupStudentStatus(str, enum.Enum):
    active = "active"
    frozen = "frozen"
    dropped = "dropped"


class GroupStudent(Base):
    __tablename__ = "group_students"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(GroupStudentStatus), default=GroupStudentStatus.active, nullable=False)
    status_reason = Column(String, nullable=True)
