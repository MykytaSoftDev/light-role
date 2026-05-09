"""Cycle-window helpers for credit quota accounting (PRD 6.11).

Credits reset on a 30-day rolling anniversary of the user's `cycle_anchor_at`
(stored on `subscriptions`). Free / unsubscribed users use `users.created_at`
as the anchor — they don't have a Subscription row in MVP.

All datetimes returned by these helpers are timezone-aware UTC. The DB
stores `cycle_anchor_at` and `users.created_at` as `DateTime(timezone=False)`
but the project convention treats them as UTC; we naive-replace tzinfo on
read to keep arithmetic safe.

This module is intentionally small and side-effect-free — both the quota
dependencies (MONETIZE-3) and (eventually) `usage_service.get_usage`
(MONETIZE-6) will consume it.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.models.subscription import Subscription
from app.models.user import User

CYCLE_LENGTH_DAYS = 30


def _as_utc(dt: datetime) -> datetime:
    """Return ``dt`` as a timezone-aware UTC datetime.

    The DB stores anchor timestamps as naive (timezone=False). We always
    treat them as UTC; this helper formalises that convention so the
    arithmetic below never silently mixes naive and aware datetimes.
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def get_cycle_anchor(user: User, subscription: Subscription | None) -> datetime:
    """Return the credit-cycle anchor timestamp for ``user``.

    - Paid subscription present → ``subscription.cycle_anchor_at``.
    - No subscription (free / pre-Paddle) → ``user.created_at``.

    Always returned as a timezone-aware UTC datetime.
    """
    if subscription is not None and subscription.cycle_anchor_at is not None:
        return _as_utc(subscription.cycle_anchor_at)
    return _as_utc(user.created_at)


def get_current_cycle_window(
    anchor: datetime, now: datetime
) -> tuple[datetime, datetime]:
    """Return ``(cycle_start, cycle_end)`` for the cycle ``now`` falls in.

    A cycle is exactly ``CYCLE_LENGTH_DAYS`` (30) days long. The current
    window starts on the most recent multiple of 30 days after ``anchor``.

        cycle_start = anchor + floor((now - anchor) / 30d) * 30d
        cycle_end   = cycle_start + 30d  (exclusive upper bound)

    If ``now < anchor`` (clock skew or back-dated user record), we treat
    the user as if they were just inside their first cycle — ``cycle_start
    = anchor`` — to avoid negative arithmetic.

    Both inputs are coerced to timezone-aware UTC before computation.
    """
    anchor_utc = _as_utc(anchor)
    now_utc = _as_utc(now)

    delta = now_utc - anchor_utc
    if delta.total_seconds() < 0:
        cycle_start = anchor_utc
    else:
        # Integer division on timedeltas gives the number of completed cycles.
        cycles_elapsed = delta // timedelta(days=CYCLE_LENGTH_DAYS)
        cycle_start = anchor_utc + timedelta(days=CYCLE_LENGTH_DAYS) * cycles_elapsed

    cycle_end = cycle_start + timedelta(days=CYCLE_LENGTH_DAYS)
    return cycle_start, cycle_end
