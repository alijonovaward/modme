from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.lesson import Lesson
from app.models.teacher_transaction import TeacherTransaction
from app.models.user import User, UserRole
from app.schemas.teacher_transaction import TeacherTransactionOut

router = APIRouter(prefix="/api/v1/teachers", tags=["teachers"])


@router.get("/finance", response_model=list[TeacherTransactionOut])
def get_teacher_finance(
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    group_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.teacher)),
):
    query = db.query(TeacherTransaction).filter(TeacherTransaction.teacher_id == current_user.id)

    if date_from is not None:
        query = query.filter(TeacherTransaction.created_at >= date_from)
    if date_to is not None:
        query = query.filter(TeacherTransaction.created_at <= date_to)
    if group_id is not None:
        query = query.join(Lesson, Lesson.id == TeacherTransaction.lesson_id).filter(
            Lesson.group_id == group_id
        )

    return query.order_by(TeacherTransaction.created_at.desc()).all()
