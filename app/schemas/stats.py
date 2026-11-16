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
