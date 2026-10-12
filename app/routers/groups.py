from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.group import Group
from app.models.group_student import GroupStudent, GroupStudentStatus
from app.models.subject import Subject
from app.models.user import User, UserRole
from app.schemas.group import (
    GroupCreate,
    GroupOut,
    GroupStudentCreate,
    GroupStudentOut,
    GroupStudentStatusUpdate,
)

router = APIRouter(prefix="/api/v1/groups", tags=["groups"])


@router.post("", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
def create_group(
    payload: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    subject = db.get(Subject, payload.subject_id)
    if subject is None:
        raise HTTPException(status_code=404, detail="Fan topilmadi")

    teacher = db.get(User, payload.teacher_id)
    if teacher is None or teacher.role != UserRole.teacher:
        raise HTTPException(status_code=404, detail="O'qituvchi topilmadi")

    if payload.lesson_price <= 0:
        raise HTTPException(status_code=400, detail="Dars narxi musbat bo'lishi kerak")

    group = Group(
        name=payload.name,
        subject_id=payload.subject_id,
        teacher_id=payload.teacher_id,
        lesson_price=payload.lesson_price,
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


def _get_group_or_404(db: Session, group_id: int) -> Group:
    group = db.get(Group, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Guruh topilmadi")
    return group


@router.post(
    "/{group_id}/students",
    response_model=GroupStudentOut,
    status_code=status.HTTP_201_CREATED,
)
def add_student_to_group(
    group_id: int,
    payload: GroupStudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    group = _get_group_or_404(db, group_id)

    student = db.get(User, payload.student_id)
    if student is None or student.role != UserRole.student:
        raise HTTPException(status_code=404, detail="O'quvchi topilmadi")

    existing = (
        db.query(GroupStudent)
        .filter(
            GroupStudent.group_id == group.id,
            GroupStudent.student_id == student.id,
            GroupStudent.status != GroupStudentStatus.dropped,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(status_code=400, detail="O'quvchi allaqachon ushbu guruhda")

    group_student = GroupStudent(group_id=group.id, student_id=student.id)
    db.add(group_student)
    db.commit()
    db.refresh(group_student)
    return group_student


@router.put(
    "/{group_id}/students/{student_id}",
    response_model=GroupStudentOut,
)
def update_group_student_status(
    group_id: int,
    student_id: int,
    payload: GroupStudentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    _get_group_or_404(db, group_id)

    group_student = (
        db.query(GroupStudent)
        .filter(GroupStudent.group_id == group_id, GroupStudent.student_id == student_id)
        .first()
    )
    if group_student is None:
        raise HTTPException(status_code=404, detail="O'quvchi ushbu guruhda topilmadi")

    group_student.status = payload.status
    db.commit()
    db.refresh(group_student)
    return group_student
