from datetime import datetime, timedelta, timezone

from app.models.enums import SubscriptionStatus
from app.models.plan import Plan
from app.models.subscription import Subscription

GRACE_PERIOD_DAYS = 7  # for past_due


def get_effective_plan(subscription: Subscription | None) -> str:
    """
    Determine the user's effective plan slug considering grace periods.

    Rules:
    - No subscription or non-pro plan slug → that slug (or "free")
    - pro + active → "pro"
    - pro + cancelled → "pro" until current_period_end, then "free"
    - pro + past_due → "pro" until current_period_end + 7 days, then "free"

    Returns the plan slug string: "free" or "pro".
    """
    if subscription is None:
        return "free"

    plan_slug = subscription.plan.code
    if plan_slug != "pro":
        return plan_slug

    if subscription.status == SubscriptionStatus.ACTIVE:
        return "pro"

    now = datetime.now(timezone.utc)

    # Make period_end timezone-aware for comparison (DB stores without tz)
    period_end = subscription.current_period_end
    if period_end.tzinfo is None:
        period_end = period_end.replace(tzinfo=timezone.utc)

    if subscription.status == SubscriptionStatus.CANCELLED:
        # Pro access continues until the billing period ends
        return "pro" if now < period_end else "free"

    if subscription.status == SubscriptionStatus.PAST_DUE:
        # Pro access continues until period_end + grace period
        grace_end = period_end + timedelta(days=GRACE_PERIOD_DAYS)
        return "pro" if now < grace_end else "free"

    return "free"


def get_plan_ai_limit(plan: Plan | None, fallback: int = 10) -> int:
    """Derive a single AI-ops monthly limit from the v2 split-credit model.

    Returns -1 (unlimited) when either credit column is NULL on the plan.
    Returns the sum of the two credit columns otherwise. Falls back to
    `fallback` when no plan is provided. This is a v1-compatibility shim
    used by code that hasn't been rewritten for split credits yet —
    see ARCH-12 in tasks-architecture.json.
    """
    if plan is None:
        return fallback
    if plan.resume_credits_per_cycle is None or plan.cl_credits_per_cycle is None:
        return -1
    return plan.resume_credits_per_cycle + plan.cl_credits_per_cycle


def get_plan_active_jobs_limit(plan: Plan | None, fallback: int = 10) -> int:
    """Translate v2 `max_active_jobs` (NULL = unlimited) to the -1 sentinel
    expected by v1 consumers. Returns `fallback` if no plan."""
    if plan is None:
        return fallback
    if plan.max_active_jobs is None:
        return -1
    return plan.max_active_jobs
