from datetime import datetime, timedelta, timezone

from app.models.enums import SubscriptionPlan, SubscriptionStatus
from app.models.subscription import Subscription

GRACE_PERIOD_DAYS = 7  # for past_due


def get_effective_plan(subscription: Subscription | None) -> SubscriptionPlan:
    """
    Determine the user's effective plan considering grace periods.

    Rules:
    - No subscription or FREE plan → FREE
    - PRO + active → PRO
    - PRO + cancelled → PRO until current_period_end, then FREE
    - PRO + past_due → PRO until current_period_end + 7 days, then FREE

    Returns SubscriptionPlan.FREE or SubscriptionPlan.PRO.
    """
    if subscription is None or subscription.plan == SubscriptionPlan.FREE:
        return SubscriptionPlan.FREE

    if subscription.status == SubscriptionStatus.ACTIVE:
        return SubscriptionPlan.PRO

    now = datetime.now(timezone.utc)

    # Make period_end timezone-aware for comparison (DB stores without tz)
    period_end = subscription.current_period_end
    if period_end.tzinfo is None:
        period_end = period_end.replace(tzinfo=timezone.utc)

    if subscription.status == SubscriptionStatus.CANCELLED:
        # Pro access continues until the billing period ends
        return SubscriptionPlan.PRO if now < period_end else SubscriptionPlan.FREE

    if subscription.status == SubscriptionStatus.PAST_DUE:
        # Pro access continues until period_end + grace period
        grace_end = period_end + timedelta(days=GRACE_PERIOD_DAYS)
        return SubscriptionPlan.PRO if now < grace_end else SubscriptionPlan.FREE

    return SubscriptionPlan.FREE
