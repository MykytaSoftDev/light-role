from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies.auth import get_verified_user
from app.models.user import User
from app.redis import check_rate_limit, get_redis_client
from app.schemas.support import SupportContactRequest, SupportContactResponse
from app.services.support_service import SupportEmailError, send_support_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/support", tags=["support"])


@router.post("/contact", response_model=SupportContactResponse)
async def contact_support(
    payload: SupportContactRequest,
    current_user: User = Depends(get_verified_user),
) -> SupportContactResponse:
    rate_limit_key = f"rate_limit:support:{current_user.id}"
    allowed, _count = await check_rate_limit(rate_limit_key, limit=1, ttl_seconds=3600)

    if not allowed:
        redis_client = await get_redis_client()
        ttl = await redis_client.ttl(rate_limit_key)
        ttl = max(ttl, 0)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="You can send a support message once per hour. Please try again later.",
            headers={"Retry-After": str(ttl)},
        )

    try:
        await send_support_email(user=current_user, data=payload)
    except SupportEmailError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to send message right now. Please try again later.",
        )

    return SupportContactResponse(
        success=True,
        message="Your message has been sent. We will reply to your email shortly.",
    )
