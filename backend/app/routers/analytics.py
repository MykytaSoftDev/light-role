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
from app.services.subscription_service import get_effective_plan

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["analytics"])


# Cache TTL for the analytics endpoint payload (SPEC §8.2).
_ANALYTICS_CACHE_TTL_SECONDS = 300


@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(
    period: Literal["7d", "30d", "90d", "all"] = Query(default="30d"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> AnalyticsResponse:
    """Return the full analytics payload for the dashboard.

    Pro-gated: free-tier users receive a 402 with an ``upgrade_url`` hint.
    Cached in Redis for ``_ANALYTICS_CACHE_TTL_SECONDS`` seconds keyed on
    ``analytics:v{settings.analytics_cache_version}:{user_id}:{period}``.
    Cache failures degrade gracefully — the endpoint still serves a fresh
    computation when Redis is unavailable.
    """
    # Pro gating (unchanged from pre-redesign — out of scope per SPEC §11).
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

    # Cache read — failures must not break the endpoint.
    try:
        cached = await redis_get(cache_key)
        if cached:
            return AnalyticsResponse.model_validate_json(cached)
    except Exception as exc:
        logger.warning(f"Redis analytics cache read error: {exc}")

    # Cache miss → compute fresh via the orchestrator.
    result = analytics_service.get_full_analytics(current_user.id, period, db)

    # Cache write — failures must not break the endpoint.
    try:
        await redis_set(
            cache_key,
            result.model_dump_json(),
            ttl_seconds=_ANALYTICS_CACHE_TTL_SECONDS,
        )
    except Exception as exc:
        logger.warning(f"Redis analytics cache write error: {exc}")

    return result
