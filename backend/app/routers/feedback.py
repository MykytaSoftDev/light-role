from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_verified_user
from app.models.user import User
from app.redis import check_rate_limit, get_redis_client
from app.schemas.feedback import FeedbackCreate, FeedbackResponse
from app.services import feedback_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/feedback", tags=["feedback"])


@router.post("", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
async def submit_feedback(
    payload: FeedbackCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
) -> FeedbackResponse:
    rate_limit_key = f"rate_limit:feedback:{current_user.id}"
    allowed, _count = await check_rate_limit(rate_limit_key, limit=1, ttl_seconds=3600)

    if not allowed:
        redis_client = await get_redis_client()
        ttl = await redis_client.ttl(rate_limit_key)
        ttl = max(ttl, 0)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="You can submit feedback once per hour. Please try again later.",
            headers={"Retry-After": str(ttl)},
        )

    user_agent = request.headers.get("user-agent")

    feedback = await feedback_service.create_feedback(
        db=db,
        user_id=current_user.id,
        data=payload,
        user_agent=user_agent,
    )

    return FeedbackResponse.model_validate(feedback)
