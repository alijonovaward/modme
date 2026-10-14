from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.teacher_transaction import TeacherTransaction, TeacherTransactionType
from app.models.transaction import Transaction, TransactionType
from app.models.user import User, UserRole
from app.schemas.stats import StatsOverviewOut

router = APIRouter(prefix="/api/v1/stats", tags=["stats"])


@router.get("/overview", response_model=StatsOverviewOut)
def get_stats_overview(
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.superadmin)),
):
    def _sum(query):
        result = query.scalar()
        return float(result) if result is not None else 0.0

    tx_query = db.query(func.sum(Transaction.amount)).filter(
        Transaction.type == TransactionType.deposit
    )
    if date_from is not None:
        tx_query = tx_query.filter(Transaction.created_at >= date_from)
    if date_to is not None:
        tx_query = tx_query.filter(Transaction.created_at <= date_to)
    total_deposits = _sum(tx_query)

    ded_query = db.query(func.sum(Transaction.amount)).filter(
        Transaction.type == TransactionType.deduction
    )
    if date_from is not None:
        ded_query = ded_query.filter(Transaction.created_at >= date_from)
    if date_to is not None:
        ded_query = ded_query.filter(Transaction.created_at <= date_to)
    total_deductions = abs(_sum(ded_query))

    earning_query = db.query(func.sum(TeacherTransaction.amount)).filter(
        TeacherTransaction.type == TeacherTransactionType.lesson_earning
    )
    if date_from is not None:
        earning_query = earning_query.filter(TeacherTransaction.created_at >= date_from)
    if date_to is not None:
        earning_query = earning_query.filter(TeacherTransaction.created_at <= date_to)
    total_teacher_earnings = _sum(earning_query)

    payout_query = db.query(func.sum(TeacherTransaction.amount)).filter(
        TeacherTransaction.type == TeacherTransactionType.payout
    )
    if date_from is not None:
        payout_query = payout_query.filter(TeacherTransaction.created_at >= date_from)
    if date_to is not None:
        payout_query = payout_query.filter(TeacherTransaction.created_at <= date_to)
    total_teacher_payouts = abs(_sum(payout_query))

    return StatsOverviewOut(
        total_deposits=total_deposits,
        total_deductions=total_deductions,
        total_teacher_earnings=total_teacher_earnings,
        total_teacher_payouts=total_teacher_payouts,
    )
