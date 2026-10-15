from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.group import Group
from app.models.group_student import GroupStudent
from app.models.lesson import Lesson
from app.models.teacher_transaction import TeacherTransaction, TeacherTransactionType
from app.models.transaction import Transaction, TransactionType
from app.models.user import User, UserRole
from app.schemas.stats import StatsOverviewOut

router = APIRouter(prefix="/api/v1/stats", tags=["stats"])


@router.get("/overview", response_model=StatsOverviewOut)
def get_stats_overview(
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    group_id: Optional[int] = Query(default=None),
    teacher_id: Optional[int] = Query(default=None),
    student_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin)),
):
    def _sum(query) -> float:
        result = query.scalar()
        return float(result) if result is not None else 0.0

    # Transaction has no direct teacher_id, so both group_id and teacher_id
    # filters require joining through Lesson (-> Group for teacher_id).
    tx_needs_lesson_join = group_id is not None or teacher_id is not None

    tx_base = db.query(func.sum(Transaction.amount))
    if tx_needs_lesson_join:
        tx_base = tx_base.join(Lesson, Lesson.id == Transaction.lesson_id)
    if date_from is not None:
        tx_base = tx_base.filter(Transaction.created_at >= date_from)
    if date_to is not None:
        tx_base = tx_base.filter(Transaction.created_at <= date_to)
    if group_id is not None:
        tx_base = tx_base.filter(Lesson.group_id == group_id)
    if teacher_id is not None:
        tx_base = tx_base.join(Group, Group.id == Lesson.group_id).filter(
            Group.teacher_id == teacher_id
        )
    if student_id is not None:
        tx_base = tx_base.filter(Transaction.student_id == student_id)

    total_deposits = _sum(tx_base.filter(Transaction.type == TransactionType.deposit))
    total_deductions = abs(_sum(tx_base.filter(Transaction.type == TransactionType.deduction)))

    # TeacherTransaction already has teacher_id and student_id directly, so
    # only group_id (via Lesson) requires a join here.
    tt_base = db.query(func.sum(TeacherTransaction.amount))
    if group_id is not None:
        tt_base = tt_base.join(Lesson, Lesson.id == TeacherTransaction.lesson_id).filter(
            Lesson.group_id == group_id
        )
    if date_from is not None:
        tt_base = tt_base.filter(TeacherTransaction.created_at >= date_from)
    if date_to is not None:
        tt_base = tt_base.filter(TeacherTransaction.created_at <= date_to)
    if teacher_id is not None:
        tt_base = tt_base.filter(TeacherTransaction.teacher_id == teacher_id)
    if student_id is not None:
        tt_base = tt_base.filter(TeacherTransaction.student_id == student_id)

    total_teacher_earnings = _sum(
        tt_base.filter(TeacherTransaction.type == TeacherTransactionType.lesson_earning)
    )
    total_teacher_payouts = abs(
        _sum(tt_base.filter(TeacherTransaction.type == TeacherTransactionType.payout))
    )

    # Current balance is a snapshot, not a dated event, so date filters don't
    # apply to it - only the student/group/teacher scope narrows it.
    balance_query = db.query(func.sum(User.balance)).filter(User.role == UserRole.student)
    if student_id is not None:
        balance_query = balance_query.filter(User.id == student_id)
    elif group_id is not None:
        roster_ids = (
            db.query(GroupStudent.student_id)
            .filter(GroupStudent.group_id == group_id)
            .distinct()
        )
        balance_query = balance_query.filter(User.id.in_(roster_ids))
    elif teacher_id is not None:
        roster_ids = (
            db.query(GroupStudent.student_id)
            .join(Group, Group.id == GroupStudent.group_id)
            .filter(Group.teacher_id == teacher_id)
            .distinct()
        )
        balance_query = balance_query.filter(User.id.in_(roster_ids))

    total_student_balance = _sum(balance_query)

    total_center_revenue = total_deductions - total_teacher_earnings

    return StatsOverviewOut(
        total_deposits=total_deposits,
        total_deductions=total_deductions,
        total_teacher_earnings=total_teacher_earnings,
        total_teacher_payouts=total_teacher_payouts,
        total_student_balance=total_student_balance,
        total_center_revenue=total_center_revenue,
    )
