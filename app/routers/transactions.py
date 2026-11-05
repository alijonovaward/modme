from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, aliased

from app.core.deps import require_roles
from app.core.excel import xlsx_response
from app.db.session import get_db
from app.models.group import Group
from app.models.lesson import Lesson
from app.models.transaction import Transaction, TransactionType
from app.models.user import User, UserRole
from app.schemas.transaction import TransactionListItemOut, TransactionListOut

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])


def _build_transactions_query(
    db: Session,
    current_user: User,
    student_id: Optional[int],
    created_by_id: Optional[int],
    group_id: Optional[int],
    type: Optional[TransactionType],
    date_from: Optional[datetime],
    date_to: Optional[datetime],
):
    StudentUser = aliased(User)
    ActorUser = aliased(User)

    query = (
        db.query(Transaction, StudentUser, ActorUser, Lesson, Group)
        .join(StudentUser, StudentUser.id == Transaction.student_id)
        .outerjoin(ActorUser, ActorUser.id == Transaction.created_by_id)
        .outerjoin(Lesson, Lesson.id == Transaction.lesson_id)
        .outerjoin(Group, Group.id == Lesson.group_id)
    )

    if current_user.role == UserRole.teacher:
        # A teacher sees deductions tied to their own groups, regardless of
        # who/what triggered them - group ownership, not personal authorship.
        query = query.filter(Group.teacher_id == current_user.id)
    elif created_by_id is not None:
        query = query.filter(Transaction.created_by_id == created_by_id)

    if student_id is not None:
        query = query.filter(Transaction.student_id == student_id)
    if group_id is not None:
        query = query.filter(Group.id == group_id)
    if type is not None:
        query = query.filter(Transaction.type == type)
    if date_from is not None:
        query = query.filter(Transaction.created_at >= date_from)
    if date_to is not None:
        query = query.filter(Transaction.created_at <= date_to)
    return query


@router.get("", response_model=TransactionListOut)
def list_transactions(
    student_id: Optional[int] = Query(default=None),
    created_by_id: Optional[int] = Query(default=None),
    group_id: Optional[int] = Query(default=None),
    type: Optional[TransactionType] = Query(default=None),
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.teacher)
    ),
):
    query = _build_transactions_query(
        db, current_user, student_id, created_by_id, group_id, type, date_from, date_to
    )

    total = query.count()
    total_deposits = (
        query.filter(Transaction.type == TransactionType.deposit)
        .with_entities(func.sum(Transaction.amount))
        .scalar()
        or 0.0
    )
    total_deductions = abs(
        query.filter(Transaction.type == TransactionType.deduction)
        .with_entities(func.sum(Transaction.amount))
        .scalar()
        or 0.0
    )

    rows = (
        query.order_by(Transaction.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [
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
            group_id=group.id if group else None,
            group_name=group.name if group else None,
            lesson_date=lesson.lesson_date if lesson else None,
        )
        for t, student, actor, lesson, group in rows
    ]
    return TransactionListOut(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_deposits=total_deposits,
        total_deductions=total_deductions,
    )


TRANSACTION_TYPE_LABELS = {TransactionType.deposit: "Kirim", TransactionType.deduction: "Chiqim"}


@router.get("/export")
def export_transactions(
    student_id: Optional[int] = Query(default=None),
    created_by_id: Optional[int] = Query(default=None),
    group_id: Optional[int] = Query(default=None),
    type: Optional[TransactionType] = Query(default=None),
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.superadmin, UserRole.admin, UserRole.teacher)
    ),
):
    query = _build_transactions_query(
        db, current_user, student_id, created_by_id, group_id, type, date_from, date_to
    )
    rows = query.order_by(Transaction.created_at.desc()).all()
    xlsx_rows = [
        [
            t.created_at,
            student.full_name,
            TRANSACTION_TYPE_LABELS.get(t.type, t.type.value),
            t.amount,
            group.name if group else "",
            lesson.lesson_date if lesson else None,
            actor.full_name if actor else "",
            t.comment or "",
        ]
        for t, student, actor, lesson, group in rows
    ]
    return xlsx_response(
        "tranzaksiyalar.xlsx",
        ["Sana", "O'quvchi", "Turi", "Summa", "Guruh", "Dars sanasi", "Kim kiritdi", "Izoh"],
        xlsx_rows,
    )
