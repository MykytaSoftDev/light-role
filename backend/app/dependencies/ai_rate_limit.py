"""Anti-abuse sliding-window rate limit on AI generations (MONETIZE-5).

This is the *uniform* protection layer that applies to ALL plans —
including Unlimited. It sits BEHIND the per-credit quota dependency
(`require_resume_credit` / `require_cl_credit`) so the user's plan-level
quota is checked first; this dependency only triggers when a single
user is making AI requests at an abusive frequency regardless of plan.

Key design points:
  - Sliding window via ZSET (see `app.redis.ai_gen_rate_limit_*`),
    cap = `settings.ai_rate_limit_per_hour` per 3600s.
  - Once the cap trips, a block sentinel is set for
    `settings.ai_rate_limit_block_duration_min` minutes — without this,
    a single timestamp aging out of the window would immediately
    re-enable the abuser.
  - Only SUCCESSFUL generations count toward the cap. The router-side
    code calls `ai_gen_rate_limit_record` only after the AI call
    actually returned usable output. Failed generations don't punish
    legitimate retries.
  - Fail-CLOSED on Redis errors: AI generation is a sensitive,
    abuse-prone, cost-bearing bucket. If Redis is unreachable we cannot
    enforce the anti-abuse cap, so we DENY with HTTP 503 rather than let
    a cache outage hand out uncapped (and uncountable) AI generations.
    This matches the auth limiters (login/forgot/register). The Redis-down
    condition is logged at ERROR level.

Audit trail decision (Option A from the brief):
  We deliberately do NOT write a `usage_log` row when the rate limit
  trips. The `usage_log.operation_type` column has an
  application-level whitelist of {tailor_resume, generate_cover_letter,
  parse_job, parse_profile} (see `app/models/usage_log.py` docstring),
  and `rate_limit_block` is not on that list. Rather than extend the
  whitelist + Pydantic Literal for a diagnostic-only event, we route
  the audit trail through Sentry (`capture_message` at warning level).
  Rate-limit triggers are operational/security signal, not business
  audit — Sentry is the right destination.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from redis.exceptions import RedisError

from app.config import settings
from app.dependencies.auth import get_verified_user
from app.models.user import User
from app.redis import (
    ai_gen_rate_limit_block,
    ai_gen_rate_limit_check,
)

logger = logging.getLogger(__name__)

ERROR_CODE_AI_RATE_LIMIT = "AI_RATE_LIMIT"
_WINDOW_SECONDS = 3600  # 1 hour — fixed by spec, not configurable


async def require_ai_gen_rate_limit(
    current_user: User = Depends(get_verified_user),
) -> None:
    """Sliding-window 25-per-hour cap on successful AI generations.

    Apply with ``Depends(require_ai_gen_rate_limit)`` AFTER the
    per-credit quota dependency. Order matters because we want the
    user-friendly "you're out of credits, upgrade" 402 to take
    precedence over the operational "you're going too fast" 429 when
    both apply.

    Raises HTTP 429 ``AI_RATE_LIMIT`` with a structured detail and a
    ``Retry-After`` header when the cap is hit. Raises HTTP 503 when Redis
    is unreachable (fail-closed — the anti-abuse cap cannot be enforced
    without Redis, so the request is denied). Returns ``None`` on success.
    """
    user_id = str(current_user.id)
    limit = settings.ai_rate_limit_per_hour
    block_seconds = settings.ai_rate_limit_block_duration_min * 60

    # 1. Check the sliding window + block flag. FAIL-CLOSED on Redis errors:
    #    AI generation is cost-bearing and abuse-prone, so a cache outage
    #    must not bypass the cap. Deny with 503 instead.
    try:
        allowed, _count, retry_after = await ai_gen_rate_limit_check(
            user_id, limit, _WINDOW_SECONDS
        )
    except RedisError as exc:
        logger.error(
            "AI rate-limit FAIL-CLOSED: Redis unavailable for user %s — "
            "denying request: %s",
            user_id,
            exc,
        )
        retry_after = 30
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error_code": ERROR_CODE_AI_RATE_LIMIT,
                "retry_after_seconds": retry_after,
                "message": "Service temporarily unavailable. Please try again shortly.",
            },
            headers={"Retry-After": str(retry_after)},
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.error(
            "AI rate-limit FAIL-CLOSED: check raised unexpectedly for user "
            "%s — denying request: %s",
            user_id,
            exc,
        )
        retry_after = 30
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error_code": ERROR_CODE_AI_RATE_LIMIT,
                "retry_after_seconds": retry_after,
                "message": "Service temporarily unavailable. Please try again shortly.",
            },
            headers={"Retry-After": str(retry_after)},
        )

    if allowed:
        return

    # 2. Cap hit. If the block flag wasn't already set (retry_after is
    #    None — meaning we got here via count >= limit), set it now so
    #    subsequent requests within the block window short-circuit on
    #    the cheap TTL check instead of hitting the ZSET path.
    if retry_after is None:
        try:
            await ai_gen_rate_limit_block(user_id, block_seconds)
        except RedisError as exc:
            logger.warning(
                "AI rate-limit: failed to set block sentinel for user %s: %s",
                user_id,
                exc,
            )
        retry_after = block_seconds

    # 3. Sentry breadcrumb — guarded so a missing/uninitialised SDK
    #    doesn't break the response path.
    try:
        import sentry_sdk

        sentry_sdk.capture_message(
            f"AI rate limit triggered for user {user_id}",
            level="warning",
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.debug("Sentry capture_message failed: %s", exc)

    # 4. Build the 429 payload. `retry_at` is an absolute ISO timestamp
    #    so the FE can render a "Try again at HH:MM" string without
    #    re-deriving it from `retry_after_seconds`.
    retry_at_iso = (
        datetime.now(timezone.utc) + timedelta(seconds=retry_after)
    ).isoformat()

    logger.warning(
        "AI rate limit triggered for user %s (limit=%d/hour, block=%ds)",
        user_id,
        limit,
        block_seconds,
    )

    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "error_code": ERROR_CODE_AI_RATE_LIMIT,
            "retry_at": retry_at_iso,
            "retry_after_seconds": retry_after,
            "message": "Too many AI generations. Try again later.",
        },
        headers={"Retry-After": str(retry_after)},
    )
