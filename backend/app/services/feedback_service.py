from __future__ import annotations

import logging
import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.models.enums import FeedbackStatus
from app.models.feedback import Feedback
from app.schemas.feedback import FeedbackCreate

logger = logging.getLogger(__name__)


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
