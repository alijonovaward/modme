from pydantic import BaseModel


class StatsOverviewOut(BaseModel):
    total_deposits: float
    total_deductions: float
    total_teacher_earnings: float
    total_teacher_payouts: float
    total_student_balance: float
    total_center_revenue: float


class TeacherStatsOut(BaseModel):
    active_student_count: int
    completed_lesson_count: int
    attendance_rate: float


class TeacherPendingCommissionOut(BaseModel):
    total_amount: float
    charge_count: int


class ReconciliationMismatchOut(BaseModel):
    user_id: int
    user_name: str
    role: str
    stored_balance: float
    computed_balance: float
    difference: float


class ReconciliationReportOut(BaseModel):
    checked_students: int
    checked_teachers: int
    mismatches: list[ReconciliationMismatchOut]
