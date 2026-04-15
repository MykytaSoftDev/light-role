from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies.auth import get_verified_user
from app.models.subscription import Subscription
from app.models.user import User
from app.redis import redis_get, redis_set
from app.schemas.analytics import AnalyticsResponse
from app.services import analytics_service
from app.services.analytics_insights import get_funnel_insight, get_resume_trend
from app.services.subscription_service import get_effective_plan

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["analytics"])


def _compute_analytics(
    user_id,
    period: Literal["7d", "30d", "90d", "all"],
    db: Session,
) -> AnalyticsResponse:
    """Run all metric queries and assemble the full AnalyticsResponse."""
    funnel_data = analytics_service.get_funnel(user_id, period, db)
    funnel_data.insight = get_funnel_insight(funnel_data.stages)

    timeline = analytics_service.get_applications_timeline(user_id, db)
    status_breakdown = analytics_service.get_status_breakdown(user_id, db)

    resume_performance = analytics_service.get_resume_performance(user_id, db)
    resume_performance.trend = get_resume_trend(resume_performance.sparkline)

    ai_operations = analytics_service.get_ai_operations_breakdown(user_id, db)
    response_time = analytics_service.get_response_time(user_id, period, db)
    hero_counters = analytics_service.get_hero_counters(user_id, period, db)
    data_sufficiency = analytics_service.get_data_sufficiency(user_id, db)

    return AnalyticsResponse(
        funnel=funnel_data,
        timeline=timeline,
        status_breakdown=status_breakdown,
        resume_performance=resume_performance,
        ai_operations=ai_operations,
        response_time=response_time,
        hero_counters=hero_counters,
        data_sufficiency=data_sufficiency,
    )


@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(
    period: Literal["7d", "30d", "90d", "all"] = Query(default="30d"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> AnalyticsResponse:
    # Require Pro subscription
    subscription = (
        db.query(Subscription)
        .filter(Subscription.user_id == current_user.id)
        .first()
    )
    effective_plan = get_effective_plan(subscription)
    if effective_plan != "pro":
        raise HTTPException(
            status_code=402,
            detail={
                "message": "Pro subscription required",
                "upgrade_url": "/dashboard/upgrade",
            },
        )

    cache_key = (
        f"analytics:v{settings.analytics_cache_version}"
        f":{current_user.id}:{period}"
    )

    # Try cache read
    try:
        cached = await redis_get(cache_key)
        if cached:
            return AnalyticsResponse.model_validate_json(cached)
    except Exception as exc:
        logger.warning(f"Redis analytics cache read error: {exc}")

    # Compute fresh
    result = _compute_analytics(current_user.id, period, db)

    # Try cache write
    try:
        await redis_set(cache_key, result.model_dump_json(), ttl_seconds=3600)
    except Exception as exc:
        logger.warning(f"Redis analytics cache write error: {exc}")

    return result
