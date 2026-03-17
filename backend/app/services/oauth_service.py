import logging
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import HTTPException, Response
from sqlalchemy.orm import Session

from app.config import settings
from app.models.enums import AuthProvider, SubscriptionPlan, SubscriptionStatus
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.user import UserResponse
from app.services.auth_service import set_auth_cookies

logger = logging.getLogger(__name__)

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


async def google_oauth_login(
    code: str, redirect_uri: str, db: Session, response: Response
) -> UserResponse:
    # 1. Exchange authorization code for Google access token.
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )

    if token_response.status_code != 200:
        logger.warning(
            "Google token exchange failed: status=%d body=%s",
            token_response.status_code,
            token_response.text[:200],
        )
        raise HTTPException(
            status_code=400,
            detail="Failed to exchange Google authorization code",
        )

    tokens = token_response.json()
    access_token = tokens.get("access_token")

    if not access_token:
        raise HTTPException(
            status_code=400,
            detail="Google did not return an access token",
        )

    # 2. Fetch the user's profile from Google.
    async with httpx.AsyncClient() as client:
        profile_response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if profile_response.status_code != 200:
        logger.warning(
            "Google userinfo fetch failed: status=%d",
            profile_response.status_code,
        )
        raise HTTPException(
            status_code=400,
            detail="Failed to get Google user profile",
        )

    profile = profile_response.json()
    google_id: str | None = profile.get("id")
    email: str = profile.get("email", "").lower().strip()
    first_name: str | None = profile.get("given_name")
    last_name: str | None = profile.get("family_name")

    if not email or not google_id:
        raise HTTPException(
            status_code=400,
            detail="Google account does not have an email address",
        )

    # 3. Find or create the user.
    user: User | None = db.query(User).filter(User.google_id == google_id).first()

    if not user:
        # Try to link to an existing email-registered account.
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.google_id = google_id
            user.auth_provider = AuthProvider.GOOGLE
            user.is_verified = True
            logger.info("Linked Google account to existing user %s", user.id)
        else:
            # Brand-new user via Google.
            user = User(
                email=email,
                google_id=google_id,
                auth_provider=AuthProvider.GOOGLE,
                is_verified=True,
                first_name=first_name,
                last_name=last_name,
            )
            db.add(user)
            db.flush()  # Populate user.id before creating the subscription row.

            subscription = Subscription(
                user_id=user.id,
                plan=SubscriptionPlan.FREE,
                status=SubscriptionStatus.ACTIVE,
                current_period_start=datetime.now(timezone.utc),
                current_period_end=datetime.now(timezone.utc) + timedelta(days=30),
            )
            db.add(subscription)
            logger.info("Created new user via Google OAuth: %s", user.id)

    db.commit()
    db.refresh(user)

    set_auth_cookies(response, str(user.id))
    logger.info("Google OAuth login successful: user %s", user.id)
    return UserResponse.model_validate(user)
