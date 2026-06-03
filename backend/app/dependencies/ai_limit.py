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

Concurrency / atomicity (security fix — atomic-ai-quota): enforcement
RESERVES the credit atomically (Redis ``INCR``) BEFORE the AI call rather
than doing a check-then-act read. Without this, N concurrent requests at
``limit - 1`` would all pass an independent read-check before any of them
incremented, blowing past the cap and incurring real OpenAI spend. The
reservation hands each concurrent caller a distinct counter value; any
caller whose value overshoots the cap immediately refunds (``DECR``) and
gets a 402. The router refunds on AI failure so failed ops stay uncharged.

Failure mode: this bucket gates cost-bearing AI spend, so it fails CLOSED.
A Redis transport error during reservation raises
:class:`RedisUnavailableError`, which we translate to HTTP 503 — we cannot
reserve the credit safely, so the AI op is denied rather than allowed.
(The DB ``usage_log`` recount is still used to *seed* the counter on a
cold cache, so the cap is enforced against the authoritative count; it is
no longer a silent fail-open fallback when Redis itself is unreachable.)
This matches the sliding-window anti-abuse limiter in ``ai_rate_limit.py``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
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
from app.redis import (
    RedisUnavailableError,
    refund_credit_usage,
    reserve_credit_usage,
)
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


@dataclass(frozen=True)
class CreditReservation:
    """A successfully-reserved AI credit, returned by the quota dependency.

    The router captures this (via the ``_quota`` dependency param) so it
    can REFUND the reservation (``DECR``) if the downstream AI op fails —
    keeping failed operations uncharged. ``user_id`` is the str form used
    in the Redis key; ``cycle_start`` pins the exact cycle bucket the
    reservation landed in (the AI call may straddle a cycle boundary, so
    the refund must target the same key that was incremented).

    A ``CreditReservation`` with ``reserved is False`` represents an
    *unlimited-plan* path where no counter was touched — the router's
    refund helper treats it as a no-op.
    """

    user_id: str
    credit_type: str
    cycle_start: datetime
    reserved: bool = True


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
) -> CreditReservation:
    """Shared quota-RESERVE core for both per-credit dependencies.

    Atomically reserves one credit before the AI call (see module
    docstring). Returns the :class:`CreditReservation` the router uses to
    refund on AI failure. Raises:

    - HTTP 402 ``error_code`` when the reservation overshoots the cap
      (and refunds the over-limit increment first).
    - HTTP 503 when Redis is unreachable (fail-closed — the cost-bearing
      op is denied because the credit cannot be reserved safely).
    """
    now = datetime.now(timezone.utc)

    subscription = (
        db.query(Subscription)
        .filter(Subscription.user_id == user.id)
        .first()
    )

    limit = _resolve_effective_limit(db, subscription, plan_column)
    # NULL on the column = unlimited. No counter to touch; hand back a
    # no-op reservation so the router's refund path stays uniform.
    if limit is None:
        return CreditReservation(
            user_id=str(user.id),
            credit_type=cost_type,
            cycle_start=now,
            reserved=False,
        )

    anchor = get_cycle_anchor(user, subscription)
    cycle_start, cycle_end = get_current_cycle_window(anchor, now)

    # Authoritative seed for a cold cache: count successful ops in the
    # cycle from usage_log. reserve_credit_usage only applies this via
    # ``SET ... NX`` (so it never clobbers an in-flight running count),
    # then INCRs on top. usage_log remains the durable source of truth —
    # a lost Redis counter self-heals from this recount.
    db_count = _count_used_in_cycle(
        db, user.id, cost_type, cycle_start, cycle_end
    )

    # Atomic reservation. Fails CLOSED: a Redis transport error raises
    # RedisUnavailableError, which we surface as 503 (deny) rather than
    # letting the cost-bearing op proceed uncounted.
    try:
        new_count = await reserve_credit_usage(
            str(user.id), cost_type, cycle_start, cycle_end, db_count
        )
    except RedisUnavailableError as exc:
        logger.error(
            "Credit reservation FAIL-CLOSED: Redis unavailable for "
            "user=%s cost_type=%s — denying AI op: %s",
            user.id,
            cost_type,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error_code": error_code,
                "message": "Service temporarily unavailable. Please try again shortly.",
                "retry_after_seconds": 30,
            },
            headers={"Retry-After": "30"},
        ) from exc

    # Over the cap → refund the increment we just made and reject. Because
    # each concurrent reserver gets a distinct value back, exactly the
    # first ``limit`` reservations land at/below the cap; the rest land
    # here and refund.
    if new_count > limit:
        await _refund_reservation(
            CreditReservation(
                user_id=str(user.id),
                credit_type=cost_type,
                cycle_start=cycle_start,
            )
        )
        effective_slug = get_effective_plan(subscription)
        logger.warning(
            "Credit quota exceeded: user_id=%s cost_type=%s plan=%s "
            "reserved=%d limit=%d (refunded)",
            user.id,
            cost_type,
            effective_slug,
            new_count,
            limit,
        )
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error_code": error_code,
                # Report the cap as the used count — the over-limit
                # increment was refunded, so the durable count is `limit`.
                "current_count": limit,
                "plan_limit": limit,
                "plan_code": effective_slug,
                "reset_at": cycle_end.isoformat(),
                "upgrade_url": "/dashboard/upgrade",
            },
        )

    return CreditReservation(
        user_id=str(user.id),
        credit_type=cost_type,
        cycle_start=cycle_start,
    )


async def _refund_reservation(reservation: CreditReservation) -> None:
    """DECR a previously-reserved credit. No-op for unlimited-plan
    reservations. Best-effort — a lost refund only ever over-counts (the
    safe side), and the next cache-miss recount from ``usage_log`` heals
    it.
    """
    if not reservation.reserved:
        return
    try:
        await refund_credit_usage(
            reservation.user_id,
            reservation.credit_type,
            reservation.cycle_start,
        )
    except Exception as exc:  # pragma: no cover - best-effort
        logger.debug(
            "Credit refund failed for user=%s cost_type=%s: %s",
            reservation.user_id,
            reservation.credit_type,
            exc,
        )


async def refund_credit_reservation(reservation: CreditReservation) -> None:
    """Public refund entry point for routers (AI-failure path).

    Routers capture the :class:`CreditReservation` from the quota
    dependency and call this when the downstream AI op fails (``success``
    False, exception, or the 502 path) so failed operations stay
    uncharged. Safe no-op for unlimited-plan reservations.
    """
    await _refund_reservation(reservation)


async def require_resume_credit(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> CreditReservation:
    """Reserve one ``plan.resume_credits_per_cycle`` credit (NULL = unlimited).

    Atomically reserves the credit BEFORE the AI call. Returns the
    :class:`CreditReservation` the router must refund (via
    :func:`refund_credit_reservation`) if the AI op fails.

    Raises HTTP 402 ``RESUME_CREDITS_EXCEEDED`` when the reservation is
    over the cap for the current cycle, or HTTP 503 when Redis is down
    (fail-closed).
    """
    return await _enforce_credit_quota(
        db=db,
        user=current_user,
        plan_column="resume_credits_per_cycle",
        cost_type=COST_TYPE_RESUME,
        error_code=ERROR_CODE_RESUME,
    )


async def require_cl_credit(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> CreditReservation:
    """Reserve one ``plan.cl_credits_per_cycle`` credit (NULL = unlimited).

    Atomically reserves the credit BEFORE the AI call. Returns the
    :class:`CreditReservation` the router must refund (via
    :func:`refund_credit_reservation`) if the AI op fails.

    Raises HTTP 402 ``CL_CREDITS_EXCEEDED`` when the reservation is over
    the cap for the current cycle, or HTTP 503 when Redis is down
    (fail-closed).
    """
    return await _enforce_credit_quota(
        db=db,
        user=current_user,
        plan_column="cl_credits_per_cycle",
        cost_type=COST_TYPE_CL,
        error_code=ERROR_CODE_CL,
    )
