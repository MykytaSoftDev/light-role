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
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.usage_log import UsageLog
from app.models.user import User
from app.services.cycle_service import get_current_cycle_window, get_cycle_anchor

logger = logging.getLogger(__name__)

# cost_type literals — mirror app/services/usage_service._compute_usage so
# per-bucket warning counts match what the dashboard / quota enforcement
# see. Defined locally to avoid importing private names from usage_service.
_COST_TYPE_RESUME = "resume_credit"
_COST_TYPE_CL = "cl_credit"


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
            params={"company": job.company},
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
            params={"company": job.company},
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
# Plan / cycle resolution helpers (shared by limit_warning + limit_reset)
# ---------------------------------------------------------------------------

def _resolve_plan(db: Session, subscription: Subscription | None) -> Plan | None:
    """Resolve the Plan governing this user's credits.

    Subscribed users use their subscription's plan; everyone else falls
    back to the seeded Free plan row (``code == "free"``). Returns None
    only if the Free plan row is somehow missing — callers treat that as
    "skip the user".
    """
    if subscription is not None:
        return subscription.plan
    return db.query(Plan).filter(Plan.code == "free").first()


def _cycle_bounds_naive(
    user: User, subscription: Subscription | None
) -> tuple[datetime, datetime]:
    """Return ``(cycle_start_naive, cycle_end_naive)`` for the user's current
    credit cycle as naive-UTC datetimes.

    Mirrors usage_service: cycle bounds come back tz-aware from
    cycle_service, but ``usage_log.created_at`` is stored naive-UTC, so we
    strip tzinfo to keep the comparison naive-vs-naive in PostgreSQL.
    """
    anchor = get_cycle_anchor(user, subscription)
    now = datetime.now(timezone.utc)
    cycle_start, cycle_end = get_current_cycle_window(anchor, now)
    return cycle_start.replace(tzinfo=None), cycle_end.replace(tzinfo=None)


def _bucket_usage(
    db: Session,
    user_id: uuid.UUID,
    cost_type: str,
    cycle_start_naive: datetime,
    cycle_end_naive: datetime,
) -> int:
    """Count successful, non-impersonated credit consumptions of ``cost_type``
    in the current cycle window. Filters mirror
    usage_service._compute_usage exactly so warning thresholds line up with
    the dashboard / hard-block accounting.
    """
    return (
        db.query(func.count(UsageLog.id))
        .filter(
            UsageLog.user_id == user_id,
            UsageLog.cost_type == cost_type,
            UsageLog.success.is_(True),
            UsageLog.impersonator_id.is_(None),
            UsageLog.created_at >= cycle_start_naive,
            UsageLog.created_at < cycle_end_naive,
        )
        .scalar()
        or 0
    )


# ---------------------------------------------------------------------------
# Generator: limit warnings (per-bucket, cycle-accurate, includes Free users)
# ---------------------------------------------------------------------------

def _limit_warning_exists_for_bucket(
    db: Session,
    user_id: uuid.UUID,
    bucket: str,
    cycle_start_naive: datetime,
) -> bool:
    """Return True if a LIMIT_WARNING for this user + bucket already exists in
    the current cycle. Dedup is per-bucket-per-cycle: a resume warning does
    not suppress a cover-letter warning, and a new cycle re-arms both.
    """
    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.type == NotificationType.LIMIT_WARNING,
            Notification.params["bucket"].astext == bucket,
            Notification.created_at >= cycle_start_naive,
        )
        .first()
        is not None
    )


async def generate_limit_warning_notifications(db: Session) -> int:
    """Create LIMIT_WARNING notifications for users at >= 80% (and < 100%) of a
    per-bucket credit limit, within the current 30-day credit cycle.

    Per-bucket: resume credits and cover-letter credits are evaluated
    independently, each producing its own warning. Buckets with an
    unlimited (NULL) limit are skipped, so an all-unlimited user never
    warns. Free users are included (they have the tightest caps and most
    need the heads-up). Dedup is per-bucket-per-cycle.

    Returns the number of notifications created.
    """
    users = db.query(User).all()

    created = 0
    for user in users:
        if not _is_pref_enabled(user, "limit_warnings"):
            continue

        subscription: Subscription | None = (
            db.query(Subscription).filter(Subscription.user_id == user.id).first()
        )
        plan = _resolve_plan(db, subscription)
        if plan is None:
            continue

        tier = plan.code  # "free" | "pro" | "unlimited"
        upsell = "unlimited" if tier == "pro" else "pro"

        cycle_start_naive, cycle_end_naive = _cycle_bounds_naive(user, subscription)

        # (bucket label, plan limit column, cost_type) — NULL limit = unlimited.
        buckets = (
            ("resume", plan.resume_credits_per_cycle, _COST_TYPE_RESUME),
            ("cover_letter", plan.cl_credits_per_cycle, _COST_TYPE_CL),
        )

        for bucket, limit, cost_type in buckets:
            if limit is None:
                # Unlimited bucket — no cap to warn about.
                continue

            used = _bucket_usage(
                db, user.id, cost_type, cycle_start_naive, cycle_end_naive
            )

            # Warn only in the [80%, 100%) band. At/over limit → hard block;
            # below 80% → too early.
            if used < limit * 0.80 or used >= limit:
                continue

            if _limit_warning_exists_for_bucket(
                db, user.id, bucket, cycle_start_naive
            ):
                continue

            pct = int(used / limit * 100)
            noun = "resume tailorings" if bucket == "resume" else "cover letters"
            cta = (
                "Go Unlimited to remove the cap."
                if upsell == "unlimited"
                else "Upgrade to Pro for more."
            )
            notification = Notification(
                user_id=user.id,
                type=NotificationType.LIMIT_WARNING,
                title="You're running low on credits",
                message=(
                    f"You've used {used} of {limit} {noun} this cycle ({pct}%). "
                    + cta
                ),
                params={
                    "bucket": bucket,
                    "used": used,
                    "limit": limit,
                    "pct": pct,
                    "upsell": upsell,
                },
            )
            db.add(notification)
            created += 1

    if created:
        db.commit()

    logger.info("Limit warning notifications created: count=%d", created)
    return created


# ---------------------------------------------------------------------------
# Generator: limit reset (cycle anniversary, includes Free users)
# ---------------------------------------------------------------------------

def _limit_reset_exists_this_cycle(
    db: Session,
    user_id: uuid.UUID,
    cycle_start_naive: datetime,
) -> bool:
    """Return True if a LIMIT_RESET for this user already exists in the
    current cycle (dedup so the daily scheduler emits at most one per
    cycle roll)."""
    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.type == NotificationType.LIMIT_RESET,
            Notification.created_at >= cycle_start_naive,
        )
        .first()
        is not None
    )


async def generate_limit_reset_notifications(db: Session) -> int:
    """Create LIMIT_RESET notifications when a user's 30-day credit cycle has
    just rolled over (anniversary-based, not calendar-month).

    The daily scheduler fires this once when the new cycle started within
    the last 24 hours. Users on an all-unlimited plan are skipped (a
    "reset" is meaningless without a cap). Free users are included.

    Returns the number of notifications created.
    """
    now = datetime.now(timezone.utc)
    users = db.query(User).all()

    created = 0
    for user in users:
        if not _is_pref_enabled(user, "limit_reset"):
            continue

        subscription: Subscription | None = (
            db.query(Subscription).filter(Subscription.user_id == user.id).first()
        )
        plan = _resolve_plan(db, subscription)
        if plan is None:
            continue

        resume_limit = plan.resume_credits_per_cycle
        cl_limit = plan.cl_credits_per_cycle

        # All-unlimited plan → nothing resets.
        if resume_limit is None and cl_limit is None:
            continue

        anchor = get_cycle_anchor(user, subscription)
        cycle_start, _ = get_current_cycle_window(anchor, now)

        # Fire only on the cycle anniversary: the current cycle must have
        # started within the last 24h. The daily scheduler then emits it
        # exactly once per roll (dedup below guards against re-runs).
        if cycle_start < now - timedelta(hours=24):
            continue

        cycle_start_naive = cycle_start.replace(tzinfo=None)
        if _limit_reset_exists_this_cycle(db, user.id, cycle_start_naive):
            continue

        notification = Notification(
            user_id=user.id,
            type=NotificationType.LIMIT_RESET,
            title="Your credits have reset",
            message=(
                f"Your credits have reset — you again have {resume_limit} "
                f"resume tailorings and {cl_limit} cover letters this cycle."
            ),
            params={"resumeLimit": resume_limit, "clLimit": cl_limit},
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
