from typing import List, Literal, Optional

from pydantic import BaseModel


class PaymentMethodResponse(BaseModel):
    type: str  # "card", "paypal", etc.
    last4: Optional[str] = None
    brand: Optional[str] = None  # "visa", "mastercard"


class NextPaymentResponse(BaseModel):
    amount: Optional[str] = None
    currency: Optional[str] = None
    date: Optional[str] = None


class SubscriptionCurrentResponse(BaseModel):
    """Response from GET /api/v1/subscriptions/current"""

    subscription_id: Optional[str] = None
    plan_name: str
    plan_slug: str
    status: str
    billing_cycle: Optional[str] = None  # "monthly" / "annual"
    current_period_start: Optional[str] = None
    current_period_end: Optional[str] = None
    next_payment: Optional[NextPaymentResponse] = None
    payment_method: Optional[PaymentMethodResponse] = None
    scheduled_change: Optional[dict] = None
    started_at: Optional[str] = None
    # Usage data
    ai_ops_used: int = 0
    ai_ops_limit: int = 10
    active_jobs: int = 0


class TransactionItem(BaseModel):
    id: str
    date: str
    amount: Optional[str] = None
    currency: str
    status: str
    description: Optional[str] = None


class TransactionListResponse(BaseModel):
    items: List[TransactionItem]
    has_more: bool = False
    next_cursor: Optional[str] = None


class CancelSubscriptionResponse(BaseModel):
    success: bool
    message: str


class PortalSessionResponse(BaseModel):
    url: str


class ChangePlanRequest(BaseModel):
    plan_code: Literal["free", "pro", "unlimited"]
    billing_cycle: Literal["monthly", "annual"]


class ChangePlanResponse(BaseModel):
    success: bool
    message: str
    new_plan_code: str
    effective_at: str  # "next_billing_period"
