from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.group import Group
from app.models.lesson import Lesson
from app.models.teacher_transaction import TeacherTransaction, TeacherTransactionType
from app.models.user import User, UserRole
from app.schemas.transaction import TeacherPayoutCreate, TeacherTransactionListItemOut

router = APIRouter(prefix="/api/v1/teachers", tags=["teachers"])


@router.get("/finance", response_model=list[TeacherTransactionListItemOut])
def get_teacher_finance(
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    group_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.teacher)),
):
    query = (
        db.query(TeacherTransaction, Lesson, Group)
        .outerjoin(Lesson, Lesson.id == TeacherTransaction.lesson_id)
        .outerjoin(Group, Group.id == Lesson.group_id)
        .filter(TeacherTransaction.teacher_id == current_user.id)
    )

    if date_from is not None:
        query = query.filter(TeacherTransaction.created_at >= date_from)
    if date_to is not None:
        query = query.filter(TeacherTransaction.created_at <= date_to)
    if group_id is not None:
        query = query.filter(Group.id == group_id)

    rows = query.order_by(TeacherTransaction.created_at.desc()).all()

    return [
        TeacherTransactionListItemOut(
            id=tt.id,
            teacher_id=tt.teacher_id,
            amount=tt.amount,
            type=tt.type,
            comment=tt.comment,
            created_at=tt.created_at,
            group_name=group.name if group else None,
            lesson_date=lesson.lesson_date if lesson else None,
        )
        for tt, lesson, group in rows
    ]


@router.post(
    "/{teacher_id}/payout",
    response_model=TeacherTransactionListItemOut,
    status_code=status.HTTP_201_CREATED,
)
def create_teacher_payout(
    teacher_id: int,
    payload: TeacherPayoutCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    teacher = db.get(User, teacher_id)
    if teacher is None or teacher.role != UserRole.teacher:
        raise HTTPException(status_code=404, detail="O'qituvchi topilmadi")

    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Summa musbat bo'lishi kerak")
    if payload.amount > teacher.balance:
        raise HTTPException(status_code=400, detail="O'qituvchi balansida yetarli mablag' yo'q")

    teacher.balance -= payload.amount
    payout = TeacherTransaction(
        teacher_id=teacher.id,
        amount=-payload.amount,
        type=TeacherTransactionType.payout,
        comment=payload.comment,
    )
    db.add(payout)
    db.commit()
    db.refresh(payout)

    return TeacherTransactionListItemOut(
        id=payout.id,
        teacher_id=payout.teacher_id,
        amount=payout.amount,
        type=payout.type,
        comment=payout.comment,
        created_at=payout.created_at,
        group_name=None,
        lesson_date=None,
    )
