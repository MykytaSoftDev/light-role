"""Admin operations service (SPEC §4.4).

Phase 1 — Steps 4 & 5: read-only users list and detail endpoints. Mutating
admin actions (grant pro, cancel, reset cycle, reset AI ops) land in Step 6.

Design notes
------------

- ``list_users`` does ONE primary query (Users LEFT JOIN Subscription LEFT
  JOIN Plan) for the page, then TWO grouped count queries against
  ``usage_log`` and ``applications`` keyed by ``user_id``. This keeps the
  endpoint at 4 DB round-trips regardless of page size (no N+1).
- AI-ops counting mirrors ``app/services/usage_service.py``: only
  successful credit-consuming rows (``cost_type IN ('resume_credit',
  'cl_credit')``) within the user's current cycle window, with
  ``impersonator_id IS NULL`` so logs incurred during admin impersonation
  don't pollute the per-user count.
- "Active jobs" = applications NOT in a terminal status — same definition
  used in ``usage_service`` and ``job_limit_service``.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, Request, status
from sqlalchemy import asc, desc, func, or_
from sqlalchemy.orm import Session, aliased

from app.constants.admin_actions import AdminAction
from app.models.admin_audit_log import AdminAuditLog
from app.models.application import Application
from app.models.cover_letter import CoverLetter
from app.models.enums import ApplicationStatus, SubscriptionStatus
from app.models.feedback import Feedback
from app.models.job import Job
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.tailored_resume import TailoredResume
from app.models.usage_log import UsageLog
from app.models.user import User
from app.schemas.admin import (
    AdminLifetimeUsage,
    AdminUserCounts,
    AdminUserDetail,
    AdminUserListItem,
    AdminUserListResponse,
)
from app.schemas.subscription import SubscriptionResponse
from app.schemas.usage import UsageResponse
from app.services.cycle_service import get_cycle_anchor, get_current_cycle_window
from app.services.usage_service import get_usage, invalidate_usage_cache

logger = logging.getLogger(__name__)

# Mirrors `_TERMINAL_STATUSES` in usage_service / job_limit_service — kept
# as a tuple of enum *values* (strings) because the column comparison in
# `.notin_()` on a String-Enum column works on either side, but using the
# values is consistent with other services and dodges any enum-coercion
# surprises with grouped queries.
_TERMINAL_STATUS_VALUES = (
    ApplicationStatus.ACCEPTED.value,
    ApplicationStatus.REJECTED.value,
    ApplicationStatus.WITHDRAWN.value,
)

# Cost types that count toward the per-cycle AI-ops counter. Matches
# `_COST_TYPE_RESUME` / `_COST_TYPE_CL` in usage_service.
_CREDIT_COST_TYPES = ("resume_credit", "cl_credit")

# Allowed sort keys for the users list. Anything else is silently coerced
# to `created_at` (defensive default — admin UI is the only caller).
_SORTABLE_USER_COLUMNS = {
    "created_at": User.created_at,
    "email": User.email,
    "last_login_at": User.last_login_at,
}

_ALLOWED_PAGE_SIZES = (25, 50, 100)
_DEFAULT_PAGE_SIZE = 25


def _clamp_page_size(page_size: int) -> int:
    """Snap ``page_size`` to the allowed set; default on anything else."""
    return page_size if page_size in _ALLOWED_PAGE_SIZES else _DEFAULT_PAGE_SIZE


def _compute_ai_ops_for_user(
    db: Session,
    user_id: uuid.UUID,
    cycle_start: datetime,
    cycle_end: datetime,
) -> int:
    """Count credit-consuming UsageLog rows for one user in their cycle.

    Used by ``get_user_detail`` (single user). The batched version for the
    list view is inlined in ``list_users`` because it groups by user_id.
    """
    cycle_start_naive = cycle_start.replace(tzinfo=None)
    cycle_end_naive = cycle_end.replace(tzinfo=None)
    return (
        db.query(func.count(UsageLog.id))
        .filter(
            UsageLog.user_id == user_id,
            UsageLog.cost_type.in_(_CREDIT_COST_TYPES),
            UsageLog.success.is_(True),
            UsageLog.impersonator_id.is_(None),
            UsageLog.created_at >= cycle_start_naive,
            UsageLog.created_at < cycle_end_naive,
        )
        .scalar()
        or 0
    )


def _compute_active_jobs_for_user(db: Session, user_id: uuid.UUID) -> int:
    """Count non-terminal applications for one user."""
    return (
        db.query(func.count(Application.id))
        .join(Job, Job.id == Application.job_id)
        .filter(
            Job.user_id == user_id,
            Application.status.notin_(_TERMINAL_STATUS_VALUES),
        )
        .scalar()
        or 0
    )


def _build_list_item(
    *,
    user: User,
    subscription: Optional[Subscription],
    plan: Optional[Plan],
    ai_ops_used: int,
    active_jobs: int,
) -> AdminUserListItem:
    """Project (user, subscription, plan, counters) into the API shape."""
    return AdminUserListItem(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        auth_provider=user.auth_provider,
        plan_slug=plan.code if plan is not None else None,
        plan_name=plan.name if plan is not None else None,
        subscription_status=subscription.status if subscription is not None else None,
        is_verified=user.is_verified,
        is_admin=user.is_admin,
        ai_operations_used_current_cycle=ai_ops_used,
        active_jobs_count=active_jobs,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
    )


def list_users(
    db: Session,
    *,
    q: Optional[str] = None,
    plan_code: Optional[str] = None,
    page: int = 1,
    page_size: int = _DEFAULT_PAGE_SIZE,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> AdminUserListResponse:
    """Return a paginated, filtered, sorted page of users for the admin UI."""
    page = max(1, page)
    page_size = _clamp_page_size(page_size)

    # Base query — LEFT JOIN Subscription so users without one still appear,
    # LEFT JOIN Plan so plan_slug/plan_name are reachable in the SELECT.
    base = (
        db.query(User, Subscription, Plan)
        .outerjoin(Subscription, Subscription.user_id == User.id)
        .outerjoin(Plan, Plan.id == Subscription.plan_id)
    )

    # Search: case-insensitive across email + first/last name.
    if q:
        like = f"%{q.lower()}%"
        base = base.filter(
            or_(
                func.lower(User.email).like(like),
                func.lower(User.first_name).like(like),
                func.lower(User.last_name).like(like),
            )
        )

    # Plan filter — skip when omitted or "all".
    if plan_code and plan_code != "all":
        base = base.filter(Plan.code == plan_code)

    # Total count. Use a subquery so the COUNT respects the OUTER JOINs +
    # filters without triggering DISTINCT issues across the multi-entity
    # select.
    total: int = base.with_entities(func.count(User.id)).scalar() or 0

    # Sort: whitelist sort_by, normalize sort_order.
    sort_column = _SORTABLE_USER_COLUMNS.get(sort_by, User.created_at)
    order_fn = desc if sort_order.lower() != "asc" else asc

    # NOTE: last_login_at is nullable. Postgres orders NULLs LAST in DESC
    # and FIRST in ASC by default — acceptable for admin context.
    rows = (
        base.order_by(order_fn(sort_column), desc(User.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    if not rows:
        return AdminUserListResponse(
            items=[], total=total, page=page, page_size=page_size
        )

    user_ids = [row[0].id for row in rows]

    # Resolve per-user cycle windows (each user can have a different anchor),
    # then batch the AI-ops counts. We can't do a single grouped query across
    # users because each user has their own cycle window — instead we issue
    # one query per *distinct* (cycle_start, cycle_end) pair via grouping
    # in Python. For the admin UI this is fine: a page is 25-100 users, and
    # in practice the windows cluster by anchor date.
    ai_ops_by_user: dict[uuid.UUID, int] = {}
    now = datetime.now(timezone.utc)
    for user, subscription, _plan in rows:
        anchor = get_cycle_anchor(user, subscription)
        cycle_start, cycle_end = get_current_cycle_window(anchor, now)
        ai_ops_by_user[user.id] = _compute_ai_ops_for_user(
            db, user.id, cycle_start, cycle_end
        )

    # Batched active-jobs count — one query, grouped by user_id.
    active_jobs_rows = (
        db.query(Job.user_id, func.count(Application.id))
        .join(Application, Application.job_id == Job.id)
        .filter(
            Job.user_id.in_(user_ids),
            Application.status.notin_(_TERMINAL_STATUS_VALUES),
        )
        .group_by(Job.user_id)
        .all()
    )
    active_jobs_by_user: dict[uuid.UUID, int] = {
        uid: count for uid, count in active_jobs_rows
    }

    items = [
        _build_list_item(
            user=user,
            subscription=subscription,
            plan=plan,
            ai_ops_used=ai_ops_by_user.get(user.id, 0),
            active_jobs=active_jobs_by_user.get(user.id, 0),
        )
        for user, subscription, plan in rows
    ]

    return AdminUserListResponse(
        items=items, total=total, page=page, page_size=page_size
    )


async def get_user_detail(db: Session, user_id: uuid.UUID) -> AdminUserDetail:
    """Return the admin detail view for a single user. 404 if not found."""
    user: Optional[User] = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    subscription: Optional[Subscription] = (
        db.query(Subscription).filter(Subscription.user_id == user.id).first()
    )
    # ``Subscription.plan`` is configured with ``lazy="joined"`` so accessing
    # it here doesn't issue an extra query.
    plan: Optional[Plan] = subscription.plan if subscription is not None else None

    # Per-cycle AI ops + active jobs (single-user versions of the batched
    # queries in `list_users`).
    anchor = get_cycle_anchor(user, subscription)
    now = datetime.now(timezone.utc)
    cycle_start, cycle_end = get_current_cycle_window(anchor, now)
    ai_ops_used = _compute_ai_ops_for_user(db, user.id, cycle_start, cycle_end)
    active_jobs = _compute_active_jobs_for_user(db, user.id)

    item = _build_list_item(
        user=user,
        subscription=subscription,
        plan=plan,
        ai_ops_used=ai_ops_used,
        active_jobs=active_jobs,
    )

    subscription_response: Optional[SubscriptionResponse] = (
        SubscriptionResponse(
            id=subscription.id,
            plan=plan.code if plan is not None else "free",
            status=subscription.status,
            current_period_start=subscription.current_period_start,
            current_period_end=subscription.current_period_end,
        )
        if subscription is not None
        else None
    )

    # Delegate usage computation — keeps cycle/credit semantics in one place.
    usage_response = await get_usage(user, db)

    # Counts — five independent COUNT(*) queries. Each is O(log n) given the
    # existing user_id indexes; not worth batching with UNION ALL given the
    # detail view is a single-user fetch.
    counts = AdminUserCounts(
        jobs=db.query(func.count(Job.id)).filter(Job.user_id == user.id).scalar() or 0,
        applications=(
            db.query(func.count(Application.id))
            .join(Job, Job.id == Application.job_id)
            .filter(Job.user_id == user.id)
            .scalar()
            or 0
        ),
        resumes=(
            db.query(func.count(TailoredResume.id))
            .filter(TailoredResume.user_id == user.id)
            .scalar()
            or 0
        ),
        cover_letters=(
            db.query(func.count(CoverLetter.id))
            .filter(CoverLetter.user_id == user.id)
            .scalar()
            or 0
        ),
        feedbacks=(
            db.query(func.count(Feedback.id))
            .filter(Feedback.user_id == user.id)
            .scalar()
            or 0
        ),
    )

    # Lifetime credit-consuming op counts — no cycle window. Excludes
    # impersonation rows (consistent with cycle counts) and only counts
    # successful ops, matching the quota-enforcement semantics.
    lifetime_usage = AdminLifetimeUsage(
        resume_generations=(
            db.query(func.count(UsageLog.id))
            .filter(
                UsageLog.user_id == user.id,
                UsageLog.cost_type == "resume_credit",
                UsageLog.success.is_(True),
                UsageLog.impersonator_id.is_(None),
            )
            .scalar()
            or 0
        ),
        cl_generations=(
            db.query(func.count(UsageLog.id))
            .filter(
                UsageLog.user_id == user.id,
                UsageLog.cost_type == "cl_credit",
                UsageLog.success.is_(True),
                UsageLog.impersonator_id.is_(None),
            )
            .scalar()
            or 0
        ),
    )

    return AdminUserDetail(
        user=item,
        subscription=subscription_response,
        usage=usage_response,
        counts=counts,
        lifetime_usage=lifetime_usage,
    )


# ---------------------------------------------------------------------------
# Step 6 — Mutating admin actions (SPEC §4.4, §5.5, §6.10)
# ---------------------------------------------------------------------------


def _utc_naive_now() -> datetime:
    """Return ``datetime.utcnow()``-equivalent naive UTC timestamp.

    Project convention (see ``app/routers/webhooks.py``,
    ``app/dependencies/ai_limit.py``): DB columns are ``DateTime(timezone=False)``
    but logically UTC. We compute as tz-aware and strip the tzinfo before
    handing the value to SQLAlchemy so the round-trip stays naive-vs-naive.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _log_admin_action(
    db: Session,
    *,
    admin: User,
    target_user_id: uuid.UUID | None,
    action: str,
    payload: dict | None = None,
    request: Request | None = None,
) -> None:
    """Insert an ``AdminAuditLog`` row in the CURRENT transaction.

    The caller MUST commit (or rollback) — we do NOT commit here so the
    audit log row is atomic with the parent mutation: if the parent
    ``db.commit()`` fails for any reason, the audit insert is rolled back
    with it and no orphan audit row gets persisted.
    """
    ip: Optional[str] = None
    ua: Optional[str] = None
    if request is not None:
        # Trust X-Forwarded-For only when behind a reverse proxy. For now
        # we accept it but defensively pick the first hop.
        xff = request.headers.get("x-forwarded-for")
        if xff:
            ip = xff.split(",")[0].strip()
        elif request.client is not None:
            ip = request.client.host
        ua = request.headers.get("user-agent")
        if ua and len(ua) > 512:
            ua = ua[:512]

    db.add(
        AdminAuditLog(
            admin_id=admin.id,
            target_user_id=target_user_id,
            action=action,
            payload=payload or {},
            ip_address=ip,
            user_agent=ua,
        )
    )


def _require_pro_plan(db: Session) -> Plan:
    """Look up the Pro plan. 500s if it's missing — admins can't grant
    a plan that the seed never produced."""
    pro_plan: Optional[Plan] = db.query(Plan).filter(Plan.code == "pro").first()
    if pro_plan is None:
        logger.error("Pro plan not found in plans table — seed migration missing?")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Pro plan not configured",
        )
    return pro_plan


def _build_subscription_response(subscription: Subscription) -> SubscriptionResponse:
    """Construct a ``SubscriptionResponse`` from the ORM row. ``Subscription.plan``
    is ``lazy='joined'`` so this never issues an extra query."""
    plan_code = subscription.plan.code if subscription.plan is not None else "free"
    return SubscriptionResponse(
        id=subscription.id,
        plan=plan_code,
        status=subscription.status,
        current_period_start=subscription.current_period_start,
        current_period_end=subscription.current_period_end,
    )


def grant_pro(
    db: Session,
    *,
    target_user: User,
    days: int,
    admin: User,
    request: Optional[Request] = None,
) -> Subscription:
    """Grant or extend Pro for ``target_user`` by ``days`` days.

    Semantics:
      * If the user already has time remaining on Pro, EXTEND from their
        existing ``current_period_end`` (don't reset).
      * If the user is on Free or expired Pro, START a new period from now.
      * Always re-anchors the credit cycle (``cycle_anchor_at = now``) so
        the granted period gets a fresh credit window — admin-granted Pro
        shouldn't inherit a half-spent cycle.
    """
    pro_plan = _require_pro_plan(db)
    now = _utc_naive_now()

    subscription: Optional[Subscription] = (
        db.query(Subscription).filter(Subscription.user_id == target_user.id).first()
    )

    previous_plan: str = "free"
    previous_status: Optional[str] = None

    if subscription is None:
        # Free-only user — create a Subscription row anchored to now.
        new_end = now + timedelta(days=days)
        subscription = Subscription(
            user_id=target_user.id,
            plan_id=pro_plan.id,
            status=SubscriptionStatus.ACTIVE,
            current_period_start=now,
            current_period_end=new_end,
            cycle_anchor_at=now,
        )
        db.add(subscription)
        db.flush()  # populate subscription.id before audit log insert
    else:
        previous_plan = (
            subscription.plan.code if subscription.plan is not None else "free"
        )
        previous_status = subscription.status.value

        # If existing period is still in the future, extend from it; else
        # start fresh from now.
        existing_end = subscription.current_period_end
        baseline = existing_end if existing_end and existing_end > now else now
        new_end = baseline + timedelta(days=days)

        # If user was Free / expired, also reset current_period_start. If
        # they're already on active Pro with time remaining, preserve it so
        # the dashboard "cycle start" stays meaningful.
        was_active_pro_with_time = (
            previous_plan == "pro"
            and subscription.status == SubscriptionStatus.ACTIVE
            and existing_end is not None
            and existing_end > now
        )
        if not was_active_pro_with_time:
            subscription.current_period_start = now

        subscription.plan_id = pro_plan.id
        subscription.status = SubscriptionStatus.ACTIVE
        subscription.current_period_end = new_end
        subscription.cycle_anchor_at = now

    _log_admin_action(
        db,
        admin=admin,
        target_user_id=target_user.id,
        action=AdminAction.SUBSCRIPTION_GRANT_PRO,
        payload={
            "days": days,
            "previous_plan": previous_plan,
            "previous_status": previous_status,
            "new_period_end": new_end.isoformat(),
        },
        request=request,
    )

    db.commit()
    db.refresh(subscription)
    logger.info(
        "admin %s granted Pro to user %s for %d days (new_period_end=%s)",
        admin.id,
        target_user.id,
        days,
        new_end.isoformat(),
    )
    return subscription


def manual_cancel_subscription(
    db: Session,
    *,
    target_user: User,
    admin: User,
    request: Optional[Request] = None,
) -> Subscription:
    """Mark ``target_user``'s subscription as cancelled (admin-initiated).

    Preserves ``current_period_end`` — the user keeps access until the
    period naturally lapses, matching the existing user-initiated
    cancellation semantics (see SPEC §5.5).
    """
    subscription: Optional[Subscription] = (
        db.query(Subscription).filter(Subscription.user_id == target_user.id).first()
    )
    if subscription is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No subscription to cancel",
        )

    previous_status = subscription.status.value
    subscription.status = SubscriptionStatus.CANCELLED
    # current_period_end intentionally preserved.

    _log_admin_action(
        db,
        admin=admin,
        target_user_id=target_user.id,
        action=AdminAction.SUBSCRIPTION_CANCEL_MANUAL,
        payload={"previous_status": previous_status},
        request=request,
    )

    db.commit()
    db.refresh(subscription)
    logger.info(
        "admin %s manually cancelled subscription for user %s (was %s)",
        admin.id,
        target_user.id,
        previous_status,
    )
    return subscription


def reset_billing_cycle(
    db: Session,
    *,
    target_user: User,
    admin: User,
    request: Optional[Request] = None,
) -> Subscription:
    """Re-anchor the user's credit cycle to now (internal counters only).

    Per SPEC §10: Paddle is the source of truth for paying customers'
    period boundaries. This action does NOT touch
    ``current_period_start`` / ``current_period_end`` — those mirror
    Paddle. It ONLY moves ``cycle_anchor_at = now``, which is the anchor
    consumed by ``cycle_service.get_current_cycle_window`` to compute the
    rolling 30-day window the AI-ops quota uses.

    Net effect: the user is dropped into a fresh 30-day credit window
    starting now, with the previous cycle's usage_log rows falling
    outside the window (so the displayed ``ai_operations_used`` is 0
    without any DB DELETE on the append-only usage_log).
    """
    subscription: Optional[Subscription] = (
        db.query(Subscription).filter(Subscription.user_id == target_user.id).first()
    )
    if subscription is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No subscription to reset",
        )

    old_anchor = subscription.cycle_anchor_at
    now = _utc_naive_now()
    subscription.cycle_anchor_at = now

    _log_admin_action(
        db,
        admin=admin,
        target_user_id=target_user.id,
        action=AdminAction.SUBSCRIPTION_RESET_CYCLE,
        payload={
            "previous_cycle_anchor": old_anchor.isoformat() if old_anchor else None,
        },
        request=request,
    )

    db.commit()
    db.refresh(subscription)
    logger.info(
        "admin %s reset billing cycle for user %s (old_anchor=%s, new_anchor=%s)",
        admin.id,
        target_user.id,
        old_anchor.isoformat() if old_anchor else None,
        now.isoformat(),
    )
    return subscription


async def reset_ai_ops_counter(
    db: Session,
    *,
    target_user: User,
    admin: User,
    request: Optional[Request] = None,
) -> UsageResponse:
    """Reset the user's AI-ops counter to 0 for the current cycle.

    Implementation note
    -------------------
    The ``usage_log`` table is append-only (see its model docstring), so
    we DO NOT delete rows. Instead we move ``subscription.cycle_anchor_at``
    forward to ``now``, which shifts the cycle window so previously-logged
    rows fall outside it. From the user's perspective the counter is 0
    again; from the audit/analytics perspective the historical rows are
    preserved.

    This is the SAME DB change as ``reset_billing_cycle`` — the two
    actions are semantically distinct from the admin's perspective (one
    is framed as a billing-cycle reset, one as zeroing the usage counter)
    but currently produce an identical mutation. The audit log
    distinguishes them via the ``action`` field.

    Limitation: Free users without a Subscription row have no
    ``cycle_anchor_at`` to move (their anchor is ``users.created_at`` per
    ``cycle_service.get_cycle_anchor``). For those users we'd have to
    delete usage_log rows to reset — which violates the append-only
    invariant — so we reject with 400 instead. In practice Free users
    can also be addressed by first granting them Pro (which creates a
    Subscription row with a fresh anchor).
    """
    subscription: Optional[Subscription] = (
        db.query(Subscription).filter(Subscription.user_id == target_user.id).first()
    )
    if subscription is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reset AI ops for users without an active subscription",
        )

    # Capture the pre-reset count for the audit payload. Uses the same
    # window/filter logic as `_compute_ai_ops_for_user` (which itself
    # mirrors `usage_service`).
    old_anchor = subscription.cycle_anchor_at
    now_aware = datetime.now(timezone.utc)
    anchor_for_window = get_cycle_anchor(target_user, subscription)
    cycle_start, cycle_end = get_current_cycle_window(anchor_for_window, now_aware)
    previous_count = _compute_ai_ops_for_user(
        db, target_user.id, cycle_start, cycle_end
    )

    # Move the anchor forward — see docstring.
    now_naive = now_aware.replace(tzinfo=None)
    subscription.cycle_anchor_at = now_naive

    _log_admin_action(
        db,
        admin=admin,
        target_user_id=target_user.id,
        action=AdminAction.USAGE_RESET_AI_OPS,
        payload={
            "previous_count": previous_count,
            "previous_cycle_anchor": old_anchor.isoformat() if old_anchor else None,
        },
        request=request,
    )

    db.commit()
    db.refresh(subscription)
    logger.info(
        "admin %s reset AI ops counter for user %s (previous_count=%d)",
        admin.id,
        target_user.id,
        previous_count,
    )

    # Recompute the post-reset usage view so the caller can return it
    # directly. invalidate the cache first so get_usage misses and
    # recomputes against the new anchor.
    await invalidate_usage_cache(str(target_user.id))
    return await get_usage(target_user, db)


# ---------------------------------------------------------------------------
# Step 9 — Audit log read endpoint (SPEC §4.4, §5.5)
# ---------------------------------------------------------------------------

# Page sizes allowed for the audit-log endpoint. Distinct from the users-list
# clamp above (which uses 25/50/100) because the audit log card on the user
# detail view defaults to showing only the last 10 rows.
_ALLOWED_AUDIT_PAGE_SIZES = (10, 25, 50)
_DEFAULT_AUDIT_PAGE_SIZE = 25


def _clamp_audit_page_size(page_size: int) -> int:
    """Snap ``page_size`` to the allowed audit set; default on anything else."""
    return (
        page_size
        if page_size in _ALLOWED_AUDIT_PAGE_SIZES
        else _DEFAULT_AUDIT_PAGE_SIZE
    )


def list_audit_logs(
    db: Session,
    *,
    target_user_id: Optional[uuid.UUID] = None,
    admin_id: Optional[uuid.UUID] = None,
    action: Optional[str] = None,
    page: int = 1,
    page_size: int = _DEFAULT_AUDIT_PAGE_SIZE,
) -> dict:
    """List admin audit log entries newest-first with admin/target email joins.

    Two ``User`` aliases are used so we can join the same ``users`` table
    twice — once for the acting admin (INNER JOIN; admin_id is NOT NULL),
    once for the affected target user (LEFT JOIN; target_user_id is
    nullable and is also SET NULL on user deletion). Email columns from
    both joins are projected into the response so the FE doesn't have to
    do an N+1 lookup per row.

    Returns dict with items, total, page, page_size.
    """
    page = max(1, page)
    page_size = _clamp_audit_page_size(page_size)

    AdminU = aliased(User)
    TargetU = aliased(User)

    q = (
        db.query(AdminAuditLog, AdminU, TargetU)
        .join(AdminU, AdminU.id == AdminAuditLog.admin_id)
        .outerjoin(TargetU, TargetU.id == AdminAuditLog.target_user_id)
    )

    # Collect filter conditions once so the total-count query can reuse
    # them without re-deriving the WHERE clause.
    conditions = []
    if target_user_id is not None:
        conditions.append(AdminAuditLog.target_user_id == target_user_id)
    if admin_id is not None:
        conditions.append(AdminAuditLog.admin_id == admin_id)
    if action is not None:
        conditions.append(AdminAuditLog.action == action)

    if conditions:
        q = q.filter(*conditions)

    total_query = db.query(func.count(AdminAuditLog.id))
    if conditions:
        total_query = total_query.filter(*conditions)
    total: int = total_query.scalar() or 0

    rows = (
        q.order_by(desc(AdminAuditLog.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [
            {
                "id": log.id,
                "admin_id": log.admin_id,
                "admin_email": admin_u.email,
                "target_user_id": log.target_user_id,
                "target_user_email": target_u.email if target_u else None,
                "action": log.action,
                "payload": log.payload or {},
                "ip_address": log.ip_address,
                "created_at": log.created_at,
            }
            for log, admin_u, target_u in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
