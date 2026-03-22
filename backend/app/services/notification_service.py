from __future__ import annotations

import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.notification import Notification

logger = logging.getLogger(__name__)


def get_notifications(
    user_id: uuid.UUID,
    db: Session,
    limit: int = 50,
) -> tuple[list[Notification], int]:
    """Return (notifications, unread_count) for the given user."""
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )

    unread_count: int = (
        db.query(func.count(Notification.id))
        .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
        .scalar()
        or 0
    )

    return notifications, unread_count


def mark_as_read(
    notification_id: uuid.UUID,
    user_id: uuid.UUID,
    db: Session,
) -> Notification:
    """Mark a single notification as read. Raises 404/403 on bad access."""
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id)
        .first()
    )

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    if notification.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    if not notification.is_read:
        notification.is_read = True
        db.commit()
        db.refresh(notification)
        logger.info(
            "Notification marked as read: notification_id=%s user_id=%s",
            notification_id,
            user_id,
        )

    return notification


def mark_all_as_read(user_id: uuid.UUID, db: Session) -> int:
    """Mark all unread notifications for the user as read. Returns updated count."""
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
        .update({"is_read": True}, synchronize_session=False)
    )
    db.commit()

    logger.info(
        "All notifications marked as read: user_id=%s count=%d",
        user_id,
        updated,
    )
    return updated
