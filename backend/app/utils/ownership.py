"""Shared ownership-loading helper.

Centralises the "load a row by id, 404 on missing-or-not-owner" pattern used
across the tailored-resume and cover-letter routers. A single 404 path on both
the "not found" and "found but owned by someone else" branches keeps row
existence opaque to a non-owner probing the URL.
"""

from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User


def load_owned_entity(
    db: Session,
    model: Any,
    entity_id: UUID,
    user: User,
    *,
    not_found_detail: str,
):
    """Load ``model`` by id, enforcing that ``user`` owns the row.

    Queries ``model`` by primary key. If the row is missing OR its
    ``user_id`` does not match ``user.id``, raises ``HTTPException(404,
    detail=not_found_detail)`` — the same 404 on both branches so existence
    is never leaked to a non-owner. Otherwise returns the row.
    """
    row = db.query(model).filter(model.id == entity_id).first()
    if row is None or row.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=not_found_detail,
        )
    return row


def assert_owned(row: Optional[Any], user: User, *, not_found_detail: str):
    """Enforce ownership on an already-loaded ``row``.

    Companion to :func:`load_owned_entity` for call sites that must load the
    row themselves (e.g. with eager-loaded relationships) but want the same
    "404 on missing-or-not-owner" semantics. Raises ``HTTPException(404,
    detail=not_found_detail)`` when ``row`` is ``None`` or not owned by
    ``user``; otherwise returns the row unchanged.
    """
    if row is None or row.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=not_found_detail,
        )
    return row
