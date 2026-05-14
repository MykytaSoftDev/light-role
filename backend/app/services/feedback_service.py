from __future__ import annotations

import logging
import uuid
from typing import Optional

from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session

from app.models.enums import FeedbackStatus, FeedbackType
from app.models.feedback import Feedback
from app.models.user import User
from app.schemas.feedback import FeedbackCreate

logger = logging.getLogger(__name__)


# Admin-facing pagination is locked to a small allow-list so callers can't
# coerce huge pages. Mirrors `_ALLOWED_PAGE_SIZES` in `admin_service`.
_ALLOWED_PAGE_SIZES = (25, 50, 100)
_DEFAULT_PAGE_SIZE = 25


def _clamp_page_size(page_size: int) -> int:
    """Snap ``page_size`` to the allowed set; default on anything else."""
    return page_size if page_size in _ALLOWED_PAGE_SIZES else _DEFAULT_PAGE_SIZE


async def create_feedback(
    db: Session,
    user_id: uuid.UUID,
    data: FeedbackCreate,
    user_agent: Optional[str] = None,
) -> Feedback:
    """Create a new feedback entry for a user."""
    feedback = Feedback(
        user_id=user_id,
        type=data.type,
        message=data.message,
        page_url=data.page_url,
        user_agent=user_agent,
        status=FeedbackStatus.NEW,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    logger.info(
        "Feedback submitted",
        extra={
            "user_id": str(user_id),
            "feedback_id": str(feedback.id),
            "feedback_type": feedback.type.value,
        },
    )

    return feedback


def list_all_feedback(
    db: Session,
    *,
    type_filter: Optional[FeedbackType] = None,
    status_filter: Optional[FeedbackStatus] = None,
    user_q: Optional[str] = None,
    page: int = 1,
    page_size: int = _DEFAULT_PAGE_SIZE,
) -> dict:
    """Admin-facing paginated listing joined with users for email/name display.

    Filters:
      * ``type_filter``   — exact match on ``Feedback.type``.
      * ``status_filter`` — exact match on ``Feedback.status``.
      * ``user_q``        — case-insensitive ilike across the joined user's
                            email, first_name, and last_name.

    Sorting is fixed to ``Feedback.created_at DESC`` (the admin viewer is
    a triage queue — newest first is the only meaningful order).
    """
    page = max(1, page)
    page_size = _clamp_page_size(page_size)

    base = db.query(Feedback, User).join(User, User.id == Feedback.user_id)

    if type_filter is not None:
        base = base.filter(Feedback.type == type_filter)
    if status_filter is not None:
        base = base.filter(Feedback.status == status_filter)
    if user_q:
        like = f"%{user_q.lower()}%"
        base = base.filter(
            or_(
                func.lower(User.email).like(like),
                func.lower(User.first_name).like(like),
                func.lower(User.last_name).like(like),
            )
        )

    # Total count of filtered rows. Counting Feedback.id is unambiguous
    # since the join is INNER and one-to-one in the SELECT shape.
    total: int = base.with_entities(func.count(Feedback.id)).scalar() or 0

    rows = (
        base.order_by(desc(Feedback.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [_build_admin_item(feedback, user) for feedback, user in rows]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def _build_admin_item(feedback: Feedback, user: User) -> dict:
    """Project (feedback, user) into the ``AdminFeedbackItem`` shape."""
    return {
        "id": feedback.id,
        "user_id": user.id,
        "user_email": user.email,
        "user_first_name": user.first_name,
        "user_last_name": user.last_name,
        "type": feedback.type,
        "status": feedback.status,
        "message": feedback.message,
        "page_url": feedback.page_url,
        "user_agent": feedback.user_agent,
        "created_at": feedback.created_at,
        "admin_notes": feedback.admin_notes,
    }
