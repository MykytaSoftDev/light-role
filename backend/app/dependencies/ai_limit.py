from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_verified_user
from app.models.enums import SubscriptionPlan
from app.models.subscription import Subscription
from app.models.user import User
from app.redis import get_usage_count
from app.services.subscription_service import get_effective_plan

logger = logging.getLogger(__name__)

PLAN_LIMITS: dict[SubscriptionPlan, int] = {
    SubscriptionPlan.FREE: 10,
    SubscriptionPlan.PRO: 100,
}


async def require_ai_quota(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> None:
    """
    FastAPI dependency that enforces monthly AI operation limits.

    - Fetches the user's subscription plan from DB.
    - Reads the current month's usage counter from Redis.
    - Raises HTTP 403 if the user is at or over their plan limit.
    - Fails open (allows the request) on Redis errors.
    """
    now = datetime.now(timezone.utc)
    year_month = now.strftime("%Y-%m")

    # Determine effective plan (respects cancellation / past_due grace periods)
    subscription = (
        db.query(Subscription)
        .filter(Subscription.user_id == current_user.id)
        .first()
    )
    effective_plan = get_effective_plan(subscription)
    limit = PLAN_LIMITS.get(effective_plan, PLAN_LIMITS[SubscriptionPlan.FREE])

    # Read current usage from Redis; get_usage_count returns 0 on error → fail open
    current_usage = await get_usage_count(str(current_user.id), year_month)

    if current_usage >= limit:
        # Calculate the first day of next month as the reset date
        if now.month == 12:
            reset_date = f"{now.year + 1}-01-01T00:00:00Z"
        else:
            reset_date = f"{now.year}-{now.month + 1:02d}-01T00:00:00Z"

        logger.warning(
            "AI quota exceeded: user_id=%s effective_plan=%s usage=%d limit=%d",
            current_user.id,
            effective_plan.value,
            current_usage,
            limit,
        )

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": "AI operation limit reached. Upgrade to Pro for more operations.",
                "current_usage": current_usage,
                "limit": limit,
                "reset_date": reset_date,
                "upgrade_url": "/dashboard/settings/billing",
            },
        )
