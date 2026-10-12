from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.group import Group
from app.models.group_student import GroupStudent, GroupStudentStatus
from app.models.lesson import Lesson
from app.models.subject import Subject
from app.models.user import User, UserRole
from app.schemas.group import (
    GroupCreate,
    GroupDetailOut,
    GroupListItemOut,
    GroupOut,
    GroupRosterItemOut,
    GroupStudentCreate,
    GroupStudentOut,
    GroupStudentStatusUpdate,
)
from app.schemas.lesson import LessonOut

router = APIRouter(prefix="/api/v1/groups", tags=["groups"])


def _to_list_item(group: Group, db: Session) -> GroupListItemOut:
    subject = db.get(Subject, group.subject_id)
    teacher = db.get(User, group.teacher_id)
    return GroupListItemOut(
        id=group.id,
        name=group.name,
        subject_id=group.subject_id,
        subject_name=subject.name if subject else "",
        teacher_id=group.teacher_id,
        teacher_name=teacher.full_name if teacher else "",
        lesson_price=group.lesson_price,
        status=group.status,
    )


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


@router.get("", response_model=list[GroupListItemOut])
def list_groups(
    teacher_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.teacher)
    ),
):
    query = db.query(Group)
    if current_user.role == UserRole.teacher:
        query = query.filter(Group.teacher_id == current_user.id)
    elif teacher_id is not None:
        query = query.filter(Group.teacher_id == teacher_id)

    return [_to_list_item(group, db) for group in query.all()]


@router.get("/{group_id}", response_model=GroupDetailOut)
def get_group_detail(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.teacher)
    ),
):
    group = _get_group_or_404(db, group_id)
    if current_user.role == UserRole.teacher and group.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu guruh sizga biriktirilmagan")

    roster = db.query(GroupStudent).filter(GroupStudent.group_id == group.id).all()
    students = []
    for gs in roster:
        student = db.get(User, gs.student_id)
        students.append(
            GroupRosterItemOut(
                id=gs.id,
                student_id=gs.student_id,
                student_name=student.full_name if student else "",
                student_phone=student.phone if student else "",
                status=gs.status,
            )
        )

    base = _to_list_item(group, db)
    return GroupDetailOut(**base.model_dump(), students=students)


@router.get("/{group_id}/lessons", response_model=list[LessonOut])
def list_group_lessons(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.teacher)
    ),
):
    group = _get_group_or_404(db, group_id)
    if current_user.role == UserRole.teacher and group.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu guruh sizga biriktirilmagan")

    return (
        db.query(Lesson)
        .filter(Lesson.group_id == group_id)
        .order_by(Lesson.lesson_date.desc())
        .all()
    )


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
