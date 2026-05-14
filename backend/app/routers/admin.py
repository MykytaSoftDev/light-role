"""Admin router (SPEC §4.5).

Phase 1 endpoints in this file:

- ``GET /admin/me``                 → minimal identity, used by the FE layout gate
- ``GET /admin/users``              → paginated users list
- ``GET /admin/users/{user_id}``    → per-user detail view

Manual subscription/usage actions, impersonation, feedback list, and the
audit-log endpoint land in subsequent steps and will be appended here.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.config import settings
from app.constants.admin_actions import AdminAction
from app.database import get_db
from app.dependencies.admin import get_current_admin_user
from app.dependencies.rate_limit import general_api_rate_limit
from app.models.enums import FeedbackStatus, FeedbackType
from app.models.user import User
from app.schemas.admin import (
    AdminAuditLogListResponse,
    AdminFeedbackListResponse,
    AdminUserDetail,
    AdminUserListResponse,
    GrantProRequest,
)
from app.schemas.subscription import SubscriptionResponse
from app.schemas.usage import UsageResponse
from app.services import admin_service, feedback_service
from app.services.admin_service import _log_admin_action
from app.services.usage_service import invalidate_usage_cache
from app.utils.security import create_impersonation_token, decode_token

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


class AdminMeResponse(BaseModel):
    """Minimal admin identity surfaced for the frontend admin layout gate."""

    id: uuid.UUID
    email: EmailStr
    first_name: Optional[str]
    is_admin: bool

    model_config = {"from_attributes": True}


@router.get("/me", response_model=AdminMeResponse)
def admin_me(current_user: User = Depends(get_current_admin_user)) -> User:
    """Return the current admin's identity.

    Used by the frontend admin layout (Server Component) to decide whether
    to render the admin area or call `notFound()`. Any non-200 response —
    including the 404 from `get_current_admin_user` for non-admins —
    triggers the standard 404 page.
    """
    return current_user


@router.get(
    "/users",
    response_model=AdminUserListResponse,
    dependencies=[Depends(general_api_rate_limit)],
)
def list_users(
    q: Optional[str] = Query(default=None, description="Search by email or name (case-insensitive)"),
    plan: Optional[str] = Query(default=None, description="Plan code filter; 'all' or omit for no filter"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, description="One of: 25, 50, 100"),
    sort_by: str = Query(default="created_at", description="created_at | email | last_login_at"),
    sort_order: str = Query(default="desc", description="asc | desc"),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> AdminUserListResponse:
    """Paginated, searchable, sortable list of users for the admin panel."""
    return admin_service.list_users(
        db,
        q=q,
        plan_code=plan,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get(
    "/users/{user_id}",
    response_model=AdminUserDetail,
    dependencies=[Depends(general_api_rate_limit)],
)
async def get_user_detail(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> AdminUserDetail:
    """Detailed admin view for a single user (profile + subscription + usage + counts)."""
    return await admin_service.get_user_detail(db, user_id)


# ---------------------------------------------------------------------------
# Step 6 — Mutating admin actions (SPEC §4.5, §5.5, §6.10)
#
# Each endpoint logs an `AdminAuditLog` row in the same transaction as the
# mutation (see `admin_service._log_admin_action`). After the commit
# succeeds we invalidate the affected user's usage cache so subsequent
# `GET /admin/users/{id}` and `GET /users/me/usage` calls reflect the
# new state immediately.
# ---------------------------------------------------------------------------


def _load_target_user(db: Session, user_id: uuid.UUID) -> User:
    target: Optional[User] = db.query(User).filter(User.id == user_id).first()
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return target


@router.post(
    "/users/{user_id}/grant-pro",
    response_model=SubscriptionResponse,
    dependencies=[Depends(general_api_rate_limit)],
)
async def grant_pro(
    user_id: uuid.UUID,
    body: GrantProRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
) -> SubscriptionResponse:
    """Manually grant or extend Pro for a user (SPEC §5.5)."""
    target = _load_target_user(db, user_id)
    subscription = admin_service.grant_pro(
        db, target_user=target, days=body.days, admin=admin, request=request
    )
    # Refresh the dashboard usage card for the target user.
    await invalidate_usage_cache(str(target.id))
    return admin_service._build_subscription_response(subscription)


@router.post(
    "/users/{user_id}/cancel-subscription",
    response_model=SubscriptionResponse,
    dependencies=[Depends(general_api_rate_limit)],
)
async def cancel_subscription(
    user_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
) -> SubscriptionResponse:
    """Mark the user's subscription as cancelled (preserves period_end)."""
    target = _load_target_user(db, user_id)
    subscription = admin_service.manual_cancel_subscription(
        db, target_user=target, admin=admin, request=request
    )
    await invalidate_usage_cache(str(target.id))
    return admin_service._build_subscription_response(subscription)


@router.post(
    "/users/{user_id}/reset-billing-cycle",
    response_model=SubscriptionResponse,
    dependencies=[Depends(general_api_rate_limit)],
)
async def reset_billing_cycle(
    user_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
) -> SubscriptionResponse:
    """Re-anchor the user's internal credit cycle to now (SPEC §10)."""
    target = _load_target_user(db, user_id)
    subscription = admin_service.reset_billing_cycle(
        db, target_user=target, admin=admin, request=request
    )
    await invalidate_usage_cache(str(target.id))
    return admin_service._build_subscription_response(subscription)


@router.post(
    "/users/{user_id}/reset-ai-ops",
    response_model=UsageResponse,
    dependencies=[Depends(general_api_rate_limit)],
)
async def reset_ai_ops(
    user_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
) -> UsageResponse:
    """Zero the AI-ops counter by re-anchoring the cycle window."""
    target = _load_target_user(db, user_id)
    # The service handles cache invalidation + fresh get_usage call so
    # the returned payload reflects the post-reset state.
    return await admin_service.reset_ai_ops_counter(
        db, target_user=target, admin=admin, request=request
    )


# ---------------------------------------------------------------------------
# Step 7 — Impersonation (SPEC §6)
#
# Start / Stop sit in the admin router because the start endpoint *requires*
# `get_current_admin_user` (only admins can begin an impersonation). Stop
# is mounted alongside intentionally — its authority comes from the
# ``original_admin_token`` cookie, not from the current request's auth
# state (which during an active impersonation belongs to the target user,
# not the admin).
# ---------------------------------------------------------------------------


# Cookie names — duplicated as local constants rather than imported from
# auth_service to keep the impersonation cookie naming co-located with the
# routes that set it.
_ACCESS_COOKIE = "access_token"
_ORIGINAL_ADMIN_COOKIE = "original_admin_token"

# 60 minutes — matches the impersonation JWT's ``exp`` so the cookie
# can't outlive the token it carries. After 60 min the admin must exit
# impersonation (or click Impersonate again).
_IMPERSONATION_COOKIE_MAX_AGE = 60 * 60


@router.post(
    "/users/{user_id}/impersonate",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(general_api_rate_limit)],
)
def impersonate_user(
    user_id: uuid.UUID,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
    access_token: Optional[str] = Cookie(default=None),
) -> Response:
    """Start an impersonation session (SPEC §6.4).

    Cookie semantics:
      * ``original_admin_token`` ← admin's current ``access_token`` value,
        60-min Max-Age. This is what :func:`stop_impersonation` reads to
        restore the admin session.
      * ``access_token`` ← freshly minted impersonation JWT (60-min exp,
        ``is_impersonating=true``, ``impersonator_id=admin.id``).
      * ``refresh_token`` is intentionally **not touched** — leaving the
        admin's refresh token in place means a refresh during
        impersonation would mint a fresh access_token for the IMPERSONATED
        user (not the admin), which is why ``POST /auth/refresh`` is
        blocked separately by :func:`block_during_impersonation`.

    Audit row is added to the same DB session as the parent action and
    committed atomically (an audit-insert failure rolls the action back).
    """
    target: Optional[User] = db.query(User).filter(User.id == user_id).first()
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    if target.is_admin:
        # SPEC §6.4: admins cannot impersonate other admins (privilege
        # escalation prevention — see also §10).
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot impersonate another admin",
        )
    if target.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot impersonate yourself",
        )
    if not access_token:
        # SPEC §6.4 step 3: no current session to derive `original_admin_token`
        # from. Race-condition path — see SPEC §9 "Race conditions".
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No active admin session",
        )

    imp_token = create_impersonation_token(str(target.id), str(admin.id))

    secure = settings.cookie_secure
    response.set_cookie(
        key=_ORIGINAL_ADMIN_COOKIE,
        value=access_token,
        max_age=_IMPERSONATION_COOKIE_MAX_AGE,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        key=_ACCESS_COOKIE,
        value=imp_token,
        max_age=_IMPERSONATION_COOKIE_MAX_AGE,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )

    _log_admin_action(
        db,
        admin=admin,
        target_user_id=target.id,
        action=AdminAction.IMPERSONATION_START,
        payload={},
        request=request,
    )
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/impersonation/stop",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(general_api_rate_limit)],
)
def stop_impersonation(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    access_token: Optional[str] = Cookie(default=None),
    original_admin_token: Optional[str] = Cookie(default=None),
) -> Response:
    """End an impersonation session and restore the admin's own access
    token (SPEC §6.5).

    NOTE: this endpoint deliberately does NOT depend on
    ``get_current_admin_user``. During an active impersonation the
    request's ``access_token`` belongs to the impersonated user (who is
    almost always *not* an admin), so admin gating would lock the admin
    out of their own exit path. Authority comes from
    ``original_admin_token``, which is validated below.
    """
    if not original_admin_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Not impersonating",
        )

    original_payload = decode_token(original_admin_token)
    if not original_payload or original_payload.get("type") != "access":
        # Admin's original session has expired. Clear cookies and force
        # them through the login flow — there's no recoverable session
        # to restore at this point.
        response.delete_cookie(_ACCESS_COOKIE, path="/")
        response.delete_cookie(_ORIGINAL_ADMIN_COOKIE, path="/")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Original admin session expired. Please log in again.",
        )

    admin_id = original_payload.get("sub")
    # SPEC §6.5 step 3: confirm the original `sub` still corresponds to an
    # admin. Guards against the (unlikely) case where the admin's flag was
    # revoked while they were impersonating.
    admin: Optional[User] = (
        db.query(User)
        .filter(User.id == admin_id, User.is_admin.is_(True))
        .first()
    )
    if admin is None:
        response.delete_cookie(_ACCESS_COOKIE, path="/")
        response.delete_cookie(_ORIGINAL_ADMIN_COOKIE, path="/")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Original admin no longer valid",
        )

    # Read the impersonation token to identify the target user for the
    # audit row. We tolerate failure here — the admin restore is the
    # primary action; the audit row is best-effort metadata.
    target_id: Optional[str] = None
    if access_token:
        imp_payload = decode_token(access_token)
        if imp_payload and imp_payload.get("is_impersonating"):
            target_id = imp_payload.get("sub")

    secure = settings.cookie_secure
    # Restore admin's access_token by writing the saved original value.
    # Max-Age matches the impersonation cookie window; the underlying JWT
    # carries its own exp so any expiry-driven invalidation still works.
    response.set_cookie(
        key=_ACCESS_COOKIE,
        value=original_admin_token,
        max_age=_IMPERSONATION_COOKIE_MAX_AGE,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )
    response.delete_cookie(_ORIGINAL_ADMIN_COOKIE, path="/")

    _log_admin_action(
        db,
        admin=admin,
        target_user_id=uuid.UUID(target_id) if target_id else None,
        action=AdminAction.IMPERSONATION_STOP,
        # `duration_seconds` placeholder: we don't currently mint an `iat`
        # claim on the impersonation token, so deriving wall-clock duration
        # from the JWT alone isn't reliable. Recorded as 0 for now; if we
        # need real durations later, add `iat` to `create_impersonation_token`
        # and subtract from `now`.
        payload={"duration_seconds": 0},
        request=request,
    )
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Step 8 — Feedback admin viewer (SPEC §4.4 last bullet, §5.6)
#
# Read-only viewer over the `feedbacks` table joined with `users`. Phase 1
# is intentionally scoped to listing only — no update/delete endpoints
# (status transitions and admin_notes editing land in a later phase).
# ---------------------------------------------------------------------------


@router.get(
    "/feedback",
    response_model=AdminFeedbackListResponse,
    dependencies=[Depends(general_api_rate_limit)],
)
def list_feedback(
    type: Optional[FeedbackType] = Query(default=None, description="Filter by feedback type"),
    # Aliased to `?status=...` in the URL but bound to a local name that
    # doesn't shadow `fastapi.status` (imported at module scope and used
    # by sibling routes for `HTTP_*` constants).
    status_filter: Optional[FeedbackStatus] = Query(
        default=None,
        alias="status",
        description="Filter by feedback status",
    ),
    q: Optional[str] = Query(
        default=None,
        description="Free-text search across user email / first_name / last_name (case-insensitive)",
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, description="One of: 25, 50, 100"),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> AdminFeedbackListResponse:
    """List all feedback for admin review.

    Filters: ``type``, ``status``, free-text ``q`` across user email/name.
    Sorted by ``created_at DESC``.
    """
    return feedback_service.list_all_feedback(
        db,
        type_filter=type,
        status_filter=status_filter,
        user_q=q,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# Step 9 — Audit log read endpoint (SPEC §4.4 last bullet, §5.5)
#
# Powers the "Last 10 admin actions" card on the user detail page and the
# (future) cross-user audit log view. Filterable by ``target_user_id``,
# ``admin_id``, and ``action``. ``action`` is a free-form string at this
# layer (no enum validation) — values outside the AdminAction whitelist
# simply return empty results.
# ---------------------------------------------------------------------------


@router.get(
    "/audit-logs",
    response_model=AdminAuditLogListResponse,
    dependencies=[Depends(general_api_rate_limit)],
)
def list_audit_logs_endpoint(
    target_user_id: Optional[uuid.UUID] = Query(default=None),
    admin_id: Optional[uuid.UUID] = Query(default=None),
    action: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, description="One of: 10, 25, 50"),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> AdminAuditLogListResponse:
    """List admin audit log entries newest-first."""
    return admin_service.list_audit_logs(
        db,
        target_user_id=target_user_id,
        admin_id=admin_id,
        action=action,
        page=page,
        page_size=page_size,
    )
