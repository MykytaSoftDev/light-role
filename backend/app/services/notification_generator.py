"""
Notification generator service.

Contains functions that scan the database for conditions that warrant
in-app notifications and create Notification records accordingly.
Called by the background scheduler (app/tasks/scheduler.py).

All generator functions use synchronous SQLAlchemy (SessionLocal) even
though the outer coroutines are declared `async` — this lets the
scheduler `await` them from an async context while keeping DB access
simple and compatible with the sync engine.
"""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.application import Application
from app.models.enums import ApplicationStatus, NotificationType
from app.models.job import Job
from app.models.notification import Notification
from app.models.subscription import Subscription
from app.models.usage_log import UsageLog
from app.models.user import User
from app.services.subscription_service import get_plan_ai_limit

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Preference helper
# ---------------------------------------------------------------------------

def _is_pref_enabled(user: User, pref_key: str) -> bool:
    """Return True if the user has a given notification preference enabled.

    Defaults to True when the key is absent (safe fallback).
    If `all_enabled` is False the entire system is muted regardless of
    individual keys.
    """
    prefs: dict = user.notification_preferences or {}
    return prefs.get("all_enabled", True) and prefs.get(pref_key, True)


# ---------------------------------------------------------------------------
# Duplicate-detection helpers
# ---------------------------------------------------------------------------

def _notification_exists_today(
    db: Session,
    user_id: uuid.UUID,
    notification_type: NotificationType,
    entity_id: uuid.UUID,
) -> bool:
    """Return True if a notification of this type + entity was already created today."""
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = today_start + timedelta(days=1)
    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.type == notification_type,
            Notification.entity_id == entity_id,
            Notification.created_at >= today_start,
            Notification.created_at < today_end,
        )
        .first()
        is not None
    )


def _notification_exists_within_days(
    db: Session,
    user_id: uuid.UUID,
    notification_type: NotificationType,
    entity_id: uuid.UUID,
    days: int,
) -> bool:
    """Return True if a notification of this type + entity was created within the last N days."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.type == notification_type,
            Notification.entity_id == entity_id,
            Notification.created_at >= cutoff,
        )
        .first()
        is not None
    )


def _notification_exists_this_month(
    db: Session,
    user_id: uuid.UUID,
    notification_type: NotificationType,
) -> bool:
    """Return True if a notification of this type was created during the current calendar month."""
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.type == notification_type,
            Notification.created_at >= month_start,
        )
        .first()
        is not None
    )


# ---------------------------------------------------------------------------
# Generator: follow-up reminders
# ---------------------------------------------------------------------------

async def generate_follow_up_notifications(db: Session) -> int:
    """Create FOLLOW_UP notifications for applications whose follow_up_date is today.

    Returns the number of notifications created.
    """
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = today_start + timedelta(days=1)

    applications = (
        db.query(Application)
        .join(Application.job)
        .filter(
            Application.follow_up_date >= today_start,
            Application.follow_up_date < today_end,
        )
        .all()
    )

    created = 0
    for app in applications:
        job: Job = app.job
        user_id: uuid.UUID = job.user_id

        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            continue

        if not _is_pref_enabled(user, "follow_up_reminders"):
            continue

        if _notification_exists_today(db, user_id, NotificationType.FOLLOW_UP, job.id):
            continue

        notification = Notification(
            user_id=user_id,
            type=NotificationType.FOLLOW_UP,
            title="Follow-up reminder",
            message=f"Time to follow up on your application to {job.company}",
            entity_type="job",
            entity_id=job.id,
        )
        db.add(notification)
        created += 1

    if created:
        db.commit()

    logger.info("Follow-up notifications created: count=%d", created)
    return created


# ---------------------------------------------------------------------------
# Generator: inactivity nudges
# ---------------------------------------------------------------------------

async def generate_inactivity_notifications(db: Session) -> int:
    """Create INACTIVITY notifications for jobs that have been in SAVED status for 5+ days.

    Returns the number of notifications created.
    """
    cutoff = datetime.utcnow() - timedelta(days=5)

    applications = (
        db.query(Application)
        .join(Application.job)
        .filter(
            Application.status == ApplicationStatus.SAVED,
            Application.updated_at < cutoff,
        )
        .all()
    )

    created = 0
    for app in applications:
        job: Job = app.job
        user_id: uuid.UUID = job.user_id

        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            continue

        if not _is_pref_enabled(user, "inactivity_nudges"):
            continue

        if _notification_exists_within_days(
            db, user_id, NotificationType.INACTIVITY, job.id, days=7
        ):
            continue

        notification = Notification(
            user_id=user_id,
            type=NotificationType.INACTIVITY,
            title="Application update needed",
            message=(
                f"Your application to {job.company} has been in Saved status "
                "for 5+ days. Consider taking action."
            ),
            entity_type="job",
            entity_id=job.id,
        )
        db.add(notification)
        created += 1

    if created:
        db.commit()

    logger.info("Inactivity notifications created: count=%d", created)
    return created


# ---------------------------------------------------------------------------
# Generator: limit warnings
# ---------------------------------------------------------------------------

def _get_current_month_usage_from_db(db: Session, user_id: uuid.UUID) -> int:
    """Count AI operations logged for the current calendar month from the DB."""
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    count: int = (
        db.query(func.count(UsageLog.id))
        .filter(
            UsageLog.user_id == user_id,
            UsageLog.created_at >= month_start,
        )
        .scalar()
        or 0
    )
    return count


async def generate_limit_warning_notifications(db: Session) -> int:
    """Create LIMIT_WARNING notifications for users who have consumed >= 80% of their quota.

    Only fires once per month per user (no duplicate within the same calendar month).
    Does not fire when the user has already hit 100% (they get a hard block instead).
    Returns the number of notifications created.
    """
    subscriptions = db.query(Subscription).all()

    created = 0
    for sub in subscriptions:
        user_id: uuid.UUID = sub.user_id
        limit = get_plan_ai_limit(sub.plan)
        # -1 means unlimited — no warning needed
        if limit == -1:
            continue

        usage = _get_current_month_usage_from_db(db, user_id)

        if usage < limit * 0.80 or usage >= limit:
            # Below threshold, or already at/over limit — no warning needed
            continue

        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            continue

        if not _is_pref_enabled(user, "limit_warnings"):
            continue

        if _notification_exists_this_month(db, user_id, NotificationType.LIMIT_WARNING):
            continue

        pct = int(usage / limit * 100)
        notification = Notification(
            user_id=user_id,
            type=NotificationType.LIMIT_WARNING,
            title="AI operation limit warning",
            message=(
                f"You've used {usage} of {limit} AI operations this month ({pct}%). "
                "Upgrade to Pro for more capacity."
            ),
        )
        db.add(notification)
        created += 1

    if created:
        db.commit()

    logger.info("Limit warning notifications created: count=%d", created)
    return created


# ---------------------------------------------------------------------------
# Generator: limit reset (1st of month only)
# ---------------------------------------------------------------------------

async def generate_limit_reset_notifications(db: Session) -> int:
    """Create LIMIT_RESET notifications on the 1st of each calendar month.

    Returns the number of notifications created (0 when today is not the 1st).
    """
    today = date.today()
    if today.day != 1:
        return 0

    subscriptions = db.query(Subscription).all()

    created = 0
    for sub in subscriptions:
        user_id: uuid.UUID = sub.user_id
        limit = get_plan_ai_limit(sub.plan)

        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            continue

        if not _is_pref_enabled(user, "limit_reset"):
            continue

        if _notification_exists_this_month(db, user_id, NotificationType.LIMIT_RESET):
            continue

        ops_available = "unlimited" if limit == -1 else str(limit)
        notification = Notification(
            user_id=user_id,
            type=NotificationType.LIMIT_RESET,
            title="AI operations reset",
            message=(
                f"Your monthly AI operation limit has reset. "
                f"You now have {ops_available} operations available."
            ),
        )
        db.add(notification)
        created += 1

    if created:
        db.commit()

    logger.info("Limit reset notifications created: count=%d", created)
    return created


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

async def generate_all_notifications(db: Session) -> dict[str, int]:
    """Run all notification generators and return a summary of counts."""
    results: dict[str, int] = {}
    results["follow_up"] = await generate_follow_up_notifications(db)
    results["inactivity"] = await generate_inactivity_notifications(db)
    results["limit_warnings"] = await generate_limit_warning_notifications(db)
    results["limit_reset"] = await generate_limit_reset_notifications(db)
    return results
