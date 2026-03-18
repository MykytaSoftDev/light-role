import json
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.application import Application
from app.models.enums import ApplicationStatus, SubscriptionPlan
from app.models.job import Job
from app.models.subscription import Subscription
from app.models.usage_log import UsageLog
from app.models.user import User
from app.redis import redis_delete, redis_get, redis_set
from app.schemas.usage import UsageResponse

logger = logging.getLogger(__name__)

_USAGE_CACHE_TTL = 300  # 5 minutes

_TERMINAL_STATUSES = {
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
}

_PLAN_LIMITS: dict[SubscriptionPlan, int] = {
    SubscriptionPlan.FREE: 10,
    SubscriptionPlan.PRO: 100,
}


def _usage_cache_key(user_id: str) -> str:
    return f"usage:{user_id}"


def _next_month_reset(now: datetime) -> datetime:
    """Return midnight UTC on the 1st of next month."""
    if now.month == 12:
        return now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    return now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)


async def get_usage(user: User, db: Session) -> UsageResponse:
    """Return usage stats for the given user, served from a 5-minute Redis cache."""
    cache_key = _usage_cache_key(str(user.id))

    cached = await redis_get(cache_key)
    if cached:
        try:
            data = json.loads(cached)
            return UsageResponse(**data)
        except Exception as exc:
            logger.warning(f"Failed to deserialise usage cache for user {user.id}: {exc}")

    result = await _compute_usage(user, db)

    try:
        payload = result.model_dump()
        # datetime is not JSON-serialisable by default; convert to ISO string
        payload["reset_date"] = result.reset_date.isoformat()
        await redis_set(cache_key, json.dumps(payload), _USAGE_CACHE_TTL)
    except Exception as exc:
        logger.warning(f"Failed to cache usage for user {user.id}: {exc}")

    return result


async def _compute_usage(user: User, db: Session) -> UsageResponse:
    now = datetime.now(timezone.utc)

    # AI operations used this calendar month
    ai_used = (
        db.query(func.count(UsageLog.id))
        .filter(
            UsageLog.user_id == user.id,
            func.extract("year", UsageLog.created_at) == now.year,
            func.extract("month", UsageLog.created_at) == now.month,
        )
        .scalar()
        or 0
    )

    # AI operations limit from subscription plan
    subscription: Optional[Subscription] = (
        db.query(Subscription).filter(Subscription.user_id == user.id).first()
    )
    plan = subscription.plan if subscription else SubscriptionPlan.FREE
    ai_limit = _PLAN_LIMITS.get(plan, _PLAN_LIMITS[SubscriptionPlan.FREE])

    # Active jobs: applications not in terminal states
    active_jobs_count = (
        db.query(func.count(Job.id))
        .join(Application, Application.job_id == Job.id)
        .filter(
            Job.user_id == user.id,
            Application.status.notin_([s.value for s in _TERMINAL_STATUSES]),
        )
        .scalar()
        or 0
    )

    # Applications submitted this calendar month
    applications_this_month = (
        db.query(func.count(Application.id))
        .join(Job, Job.id == Application.job_id)
        .filter(
            Job.user_id == user.id,
            Application.date_applied.isnot(None),
            func.extract("year", Application.date_applied) == now.year,
            func.extract("month", Application.date_applied) == now.month,
        )
        .scalar()
        or 0
    )

    reset_date = _next_month_reset(now)

    return UsageResponse(
        ai_operations_used=ai_used,
        ai_operations_limit=ai_limit,
        reset_date=reset_date,
        active_jobs_count=active_jobs_count,
        applications_this_month=applications_this_month,
    )


async def invalidate_usage_cache(user_id: str) -> None:
    """Delete the cached usage entry for a user. Call after any AI operation completes."""
    key = _usage_cache_key(user_id)
    await redis_delete(key)
    logger.debug(f"Usage cache invalidated for user {user_id}")
