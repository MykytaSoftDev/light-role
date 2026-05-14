"""FastAPI dependencies that enforce per-credit AI quotas (MONETIZE-3).

Two split dependencies — one per credit type — each tied to its own
plan column:

    ``require_resume_credit`` → ``plan.resume_credits_per_cycle``
    ``require_cl_credit``     → ``plan.cl_credits_per_cycle``

Both follow the same shape:

    1. Load the user's subscription (with eager-joined plan).
    2. Read the plan column. ``None`` → unlimited, return early.
    3. If the user is in past_due grace and the *effective* plan has
       downgraded to "free", cap against the FREE plan's column instead
       of the (still-attached) Pro/Unlimited plan. Free-plan limits are
       fetched from the DB — no hardcoded sentinels.
    4. Resolve the current credit-cycle window (PRD 6.11).
    5. Read counter from Redis. On miss, recount from ``usage_log``
       filtered by ``cost_type`` and the cycle window, then cache.
    6. If counter ≥ limit → raise HTTP 402 with a structured detail
       payload the FE can deserialise into its existing
       ``LimitReachedError`` flow.

Failure mode: Redis errors are logged and swallowed (fail-open). The
DB recount path is the source of truth — Redis is just a hot cache.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_verified_user
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.usage_log import UsageLog
from app.models.user import User
from app.redis import get_credit_usage, set_credit_usage
from app.services.cycle_service import get_current_cycle_window, get_cycle_anchor
from app.services.subscription_service import get_effective_plan

logger = logging.getLogger(__name__)

# Cost-type literals — MUST match what the routers write to ``usage_log``
# (see app/routers/jobs.py::_log_tailor_usage and ::_log_cl_usage). These
# are also the ``credit_type`` segment of Redis keys in
# ``app.redis.get_credit_usage`` etc.
COST_TYPE_RESUME = "resume_credit"
COST_TYPE_CL = "cl_credit"

ERROR_CODE_RESUME = "RESUME_CREDITS_EXCEEDED"
ERROR_CODE_CL = "CL_CREDITS_EXCEEDED"


def _resolve_effective_limit(
    db: Session, subscription: Subscription | None, column: str
) -> int | None:
    """Return the cap to enforce for ``column`` on the user's effective plan.

    ``column`` is the attribute name on ``Plan`` to read — either
    ``"resume_credits_per_cycle"`` or ``"cl_credits_per_cycle"``.

    Returns ``None`` if the effective plan grants unlimited credits for
    this column; otherwise an int cap.

    Past-due grace handling: when ``get_effective_plan`` reports "free"
    but the attached plan is still Pro/Unlimited (because the
    subscription row hasn't been downgraded yet), we cap against the
    FREE plan's column from the DB. No hardcoded fallback.
    """
    plan: Plan | None = subscription.plan if subscription else None
    effective_slug = get_effective_plan(subscription)

    # If the effective plan disagrees with the attached plan slug, force
    # the FREE-plan limits. This catches Pro/Unlimited + past_due past the
    # grace window where the user has effectively downgraded.
    if plan is not None and effective_slug != plan.code:
        plan = db.query(Plan).filter(Plan.code == effective_slug).first()
    elif plan is None:
        # No subscription row at all — unsubscribed users live on Free.
        plan = db.query(Plan).filter(Plan.code == "free").first()

    if plan is None:
        # No plan row found in DB — should not happen post-seed. Fail-safe
        # by returning a conservative cap of 0 so the user is blocked
        # rather than handed unlimited credits.
        logger.error(
            "_resolve_effective_limit: no plan row found for slug %s — "
            "blocking AI op as a safety fallback.",
            effective_slug,
        )
        return 0

    return getattr(plan, column)


def _count_used_in_cycle(
    db: Session,
    user_id,
    cost_type: str,
    cycle_start: datetime,
    cycle_end: datetime,
) -> int:
    """Recount successful credit-consuming ops in ``[cycle_start, cycle_end)``.

    Filters by ``cost_type`` (NOT ``operation_type``) so this naturally
    handles the future case where the same cost type can be charged by
    multiple operation types.

    Rows generated during admin impersonation (``impersonator_id IS NOT
    NULL``) are EXCLUDED from quota — they exist for audit only
    (SPEC §6.8).
    """
    # ``usage_log.created_at`` is stored as naive UTC. Strip tzinfo from
    # cycle bounds so the comparison stays naive-vs-naive in PostgreSQL.
    start_naive = cycle_start.replace(tzinfo=None)
    end_naive = cycle_end.replace(tzinfo=None)

    return (
        db.query(func.count(UsageLog.id))
        .filter(
            UsageLog.user_id == user_id,
            UsageLog.cost_type == cost_type,
            UsageLog.success.is_(True),
            UsageLog.impersonator_id.is_(None),
            UsageLog.created_at >= start_naive,
            UsageLog.created_at < end_naive,
        )
        .scalar()
        or 0
    )


async def _enforce_credit_quota(
    *,
    db: Session,
    user: User,
    plan_column: str,
    cost_type: str,
    error_code: str,
) -> None:
    """Shared quota-check core for both per-credit dependencies."""
    now = datetime.now(timezone.utc)

    subscription = (
        db.query(Subscription)
        .filter(Subscription.user_id == user.id)
        .first()
    )

    limit = _resolve_effective_limit(db, subscription, plan_column)
    # NULL on the column = unlimited. Skip the check entirely.
    if limit is None:
        return

    anchor = get_cycle_anchor(user, subscription)
    cycle_start, cycle_end = get_current_cycle_window(anchor, now)

    # Try Redis first.
    current_count: int | None = None
    try:
        current_count = await get_credit_usage(
            str(user.id), cost_type, cycle_start
        )
    except Exception as exc:  # pragma: no cover - defensive; fail-open below
        logger.warning(
            "Redis lookup failed for %s/%s — falling back to DB recount: %s",
            user.id,
            cost_type,
            exc,
        )
        current_count = None

    # Cache miss → recount from DB and cache the result.
    if current_count is None:
        current_count = _count_used_in_cycle(
            db, user.id, cost_type, cycle_start, cycle_end
        )
        try:
            await set_credit_usage(
                str(user.id), cost_type, cycle_start, current_count
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug(
                "Could not warm credit-usage cache for user %s: %s",
                user.id,
                exc,
            )

    if current_count >= limit:
        # Build the effective plan code for the error payload from the
        # same effective-plan logic used to pick the limit.
        effective_slug = get_effective_plan(subscription)
        logger.warning(
            "Credit quota exceeded: user_id=%s cost_type=%s plan=%s "
            "used=%d limit=%d",
            user.id,
            cost_type,
            effective_slug,
            current_count,
            limit,
        )
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error_code": error_code,
                "current_count": current_count,
                "plan_limit": limit,
                "plan_code": effective_slug,
                "reset_at": cycle_end.isoformat(),
                "upgrade_url": "/dashboard/upgrade",
            },
        )


async def require_resume_credit(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> None:
    """Enforce ``plan.resume_credits_per_cycle`` (NULL = unlimited).

    Raises HTTP 402 ``RESUME_CREDITS_EXCEEDED`` when the user is at or
    over the cap for the current 30-day cycle.
    """
    await _enforce_credit_quota(
        db=db,
        user=current_user,
        plan_column="resume_credits_per_cycle",
        cost_type=COST_TYPE_RESUME,
        error_code=ERROR_CODE_RESUME,
    )


async def require_cl_credit(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> None:
    """Enforce ``plan.cl_credits_per_cycle`` (NULL = unlimited).

    Raises HTTP 402 ``CL_CREDITS_EXCEEDED`` when the user is at or
    over the cap for the current 30-day cycle.
    """
    await _enforce_credit_quota(
        db=db,
        user=current_user,
        plan_column="cl_credits_per_cycle",
        cost_type=COST_TYPE_CL,
        error_code=ERROR_CODE_CL,
    )
