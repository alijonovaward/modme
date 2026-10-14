from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, aliased

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.transaction import Transaction, TransactionType
from app.models.user import User, UserRole
from app.schemas.transaction import TransactionListItemOut

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionListItemOut])
def list_transactions(
    student_id: Optional[int] = Query(default=None),
    created_by_id: Optional[int] = Query(default=None),
    type: Optional[TransactionType] = Query(default=None),
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin, UserRole.admin)),
):
    StudentUser = aliased(User)
    ActorUser = aliased(User)

    query = (
        db.query(Transaction, StudentUser, ActorUser)
        .join(StudentUser, StudentUser.id == Transaction.student_id)
        .outerjoin(ActorUser, ActorUser.id == Transaction.created_by_id)
    )

    if current_user.role == UserRole.admin:
        query = query.filter(Transaction.created_by_id == current_user.id)
    elif created_by_id is not None:
        query = query.filter(Transaction.created_by_id == created_by_id)

    if student_id is not None:
        query = query.filter(Transaction.student_id == student_id)
    if type is not None:
        query = query.filter(Transaction.type == type)
    if date_from is not None:
        query = query.filter(Transaction.created_at >= date_from)
    if date_to is not None:
        query = query.filter(Transaction.created_at <= date_to)

    rows = query.order_by(Transaction.created_at.desc()).all()

    return [
        TransactionListItemOut(
            id=t.id,
            student_id=t.student_id,
            student_name=student.full_name,
            amount=t.amount,
            type=t.type,
            comment=t.comment,
            created_at=t.created_at,
            created_by_id=t.created_by_id,
            created_by_name=actor.full_name if actor else None,
        )
        for t, student, actor in rows
    ]
