from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_verified_user
from app.models.enums import SubscriptionPlan
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.subscription import PlanLimits, SubscriptionDetailResponse
from app.services.subscription_service import get_effective_plan
from app.services.usage_service import get_usage

router = APIRouter(prefix="/api/v1/subscriptions", tags=["subscriptions"])

_PLAN_LIMITS: dict[SubscriptionPlan, PlanLimits] = {
    SubscriptionPlan.FREE: PlanLimits(ai_operations=10, active_jobs=10),
    SubscriptionPlan.PRO: PlanLimits(ai_operations=100, active_jobs=None),
}


@router.get("", response_model=SubscriptionDetailResponse)
async def get_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    subscription: Subscription | None = (
        db.query(Subscription).filter(Subscription.user_id == current_user.id).first()
    )
    if subscription is None:
        raise HTTPException(status_code=404, detail="Subscription not found")

    usage = await get_usage(current_user, db)
    effective_plan = get_effective_plan(subscription)
    limits = _PLAN_LIMITS.get(effective_plan, _PLAN_LIMITS[SubscriptionPlan.FREE])

    return SubscriptionDetailResponse(
        id=subscription.id,
        plan=subscription.plan,
        status=subscription.status,
        current_period_start=subscription.current_period_start,
        current_period_end=subscription.current_period_end,
        paddle_subscription_id=subscription.paddle_subscription_id,
        limits=limits,
        current_usage=usage.ai_operations_used,
        reset_date=usage.reset_date,
    )
