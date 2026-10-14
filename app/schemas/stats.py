from pydantic import BaseModel


class StatsOverviewOut(BaseModel):
    total_deposits: float
    total_deductions: float
    total_teacher_earnings: float
    total_teacher_payouts: float
