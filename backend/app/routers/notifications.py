from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_verified_user
from app.models.user import User
from app.schemas.notification import NotificationListResponse, NotificationResponse
from app.services import notification_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> NotificationListResponse:
    notifications, unread_count = notification_service.get_notifications(
        user_id=current_user.id,
        db=db,
    )
    return NotificationListResponse(
        notifications=notifications,
        unread_count=unread_count,
    )


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_as_read(
    notification_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> NotificationResponse:
    notification = notification_service.mark_as_read(
        notification_id=notification_id,
        user_id=current_user.id,
        db=db,
    )
    return notification


@router.post("/read-all")
def mark_all_notifications_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> dict:
    count = notification_service.mark_all_as_read(
        user_id=current_user.id,
        db=db,
    )
    return {"message": "All notifications marked as read", "count": count}
