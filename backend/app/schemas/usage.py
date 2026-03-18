from datetime import datetime

from pydantic import BaseModel


class UsageResponse(BaseModel):
    ai_operations_used: int
    ai_operations_limit: int
    reset_date: datetime
    active_jobs_count: int
    applications_this_month: int
