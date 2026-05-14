"""Impersonation-aware session context (SPEC §6.4, §6.6, §6.7, §9).

This module exposes three things every impersonation-touched route
relies on:

1. :class:`SessionContext` — a dataclass bundling the effective acting
   user, the impersonating admin (when present), and the original JWT
   payload. Routes that need to distinguish "real session" from
   "impersonation session" depend on :func:`get_session_context` instead
   of ``get_current_user``.

2. :func:`block_during_impersonation` — a small dependency that raises
   ``HTTP 403`` when the request is part of an impersonation session.
   Mounted on destructive / money-touching endpoints (delete account,
   change password, subscription mutations, refresh).

3. :func:`block_logout_during_impersonation` — same shape, but returns
   a friendlier message pointing the admin at the "Exit impersonation"
   action. Logging out mid-impersonation would orphan the admin's own
   session, so we redirect them to the proper exit path (SPEC §6.7).

Sentry tagging
--------------
When the context resolves to an impersonation session we tag the active
Sentry scope with ``impersonating: true``, ``impersonator_id`` and
``target_user_id`` so errors raised during admin debugging sessions are
trivially filterable in Sentry (SPEC §9). The tagging is best-effort —
if Sentry isn't configured (no DSN) the calls are silent no-ops.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import sentry_sdk
from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.utils.security import decode_token


@dataclass
class SessionContext:
    """Resolved request session, impersonation-aware.

    Attributes:
        user: The effective acting user — the impersonated target when
            ``is_impersonating`` is True, otherwise the authenticated user
            themself. Most route handlers should keep using this exactly
            as if it were the result of ``get_current_user``.
        is_impersonating: True when the JWT carries ``is_impersonating``.
        impersonator: The admin behind the impersonation, looked up from
            the JWT's ``impersonator_id`` claim. ``None`` for regular
            sessions.
        raw_payload: The decoded JWT payload, exposed for advanced uses
            (e.g. reading ``exp`` to compute remaining session time).
    """

    user: User
    is_impersonating: bool
    impersonator: Optional[User]
    raw_payload: dict


def get_session_context(
    db: Session = Depends(get_db),
    access_token: Optional[str] = Cookie(default=None),
    # original_admin_token is intentionally accepted but not consumed here
    # — :func:`stop_impersonation` reads it directly. Declaring it on the
    # dependency keeps the cookie visible in the OpenAPI schema for any
    # endpoint that depends on this function.
    original_admin_token: Optional[str] = Cookie(default=None),
) -> SessionContext:
    """Resolve the current request into a :class:`SessionContext`.

    Mirrors the validation in ``get_current_user`` (so impersonation-aware
    routes can depend on this in place of it), then layers in the
    impersonation lookup when the JWT carries ``is_impersonating``.
    """
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = decode_token(access_token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    is_imp = bool(payload.get("is_impersonating"))
    impersonator: Optional[User] = None
    if is_imp:
        imp_id = payload.get("impersonator_id")
        if imp_id:
            impersonator = db.query(User).filter(User.id == imp_id).first()

    # Sentry tagging (SPEC §9). Wrapped in a best-effort guard so a
    # mis-configured Sentry never breaks request handling.
    if is_imp and impersonator is not None:
        try:
            sentry_sdk.set_tag("impersonating", True)
            sentry_sdk.set_tag("impersonator_id", str(impersonator.id))
            sentry_sdk.set_tag("target_user_id", str(user.id))
        except Exception:  # pragma: no cover - defensive
            pass

    return SessionContext(
        user=user,
        is_impersonating=is_imp,
        impersonator=impersonator,
        raw_payload=payload,
    )


def block_during_impersonation(
    ctx: SessionContext = Depends(get_session_context),
) -> None:
    """Reject destructive / money-touching routes during impersonation
    (SPEC §6.7).

    Generic 403 — the admin is expected to "Exit impersonation" first and
    perform the action under their own session if it's actually warranted.
    """
    if ctx.is_impersonating:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden in impersonation mode",
        )


def block_logout_during_impersonation(
    ctx: SessionContext = Depends(get_session_context),
) -> None:
    """Like :func:`block_during_impersonation` but with a helpful hint.

    Logging out during impersonation would orphan the admin's session
    (the impersonation cookie would clear but ``original_admin_token``
    is also cleared by ``clear_auth_cookies``). The admin should use
    "Exit impersonation" instead, which restores the admin cookie atomically.
    """
    if ctx.is_impersonating:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot log out during impersonation. Use 'Exit impersonation' instead.",
        )
