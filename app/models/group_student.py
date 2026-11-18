import enum

from sqlalchemy import Column, Index, Integer, String, ForeignKey, Enum, text

from app.db.session import Base


class GroupStudentStatus(str, enum.Enum):
    active = "active"
    frozen = "frozen"
    dropped = "dropped"


class GroupStudent(Base):
    __tablename__ = "group_students"
    __table_args__ = (
        # A student can only have ONE non-dropped membership row per group - but may
        # be dropped and later re-enrolled, which legitimately leaves multiple rows
        # for the same (group_id, student_id) pair, so the uniqueness only applies
        # while status != 'dropped'.
        Index(
            "uq_group_students_active",
            "group_id",
            "student_id",
            unique=True,
            postgresql_where=text("status != 'dropped'"),
            sqlite_where=text("status != 'dropped'"),
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(Enum(GroupStudentStatus), default=GroupStudentStatus.active, nullable=False)
    status_reason = Column(String, nullable=True)
