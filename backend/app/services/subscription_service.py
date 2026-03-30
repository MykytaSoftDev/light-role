from datetime import datetime, timedelta, timezone

from app.models.enums import SubscriptionStatus
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

    plan_slug = subscription.plan.slug
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
