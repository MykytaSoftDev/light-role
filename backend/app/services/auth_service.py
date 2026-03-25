import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, Response, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models.enums import AuthProvider, SubscriptionPlan, SubscriptionStatus
from app.models.subscription import Subscription
from app.models.user import User
from app.redis import delete_token, get_token_user, store_token
from app.schemas.auth import ChangePasswordRequest, ForgotPasswordRequest, LoginRequest, RegisterRequest, ResetPasswordRequest
from app.schemas.user import UserResponse
from app.services.email_service import send_password_reset_email, send_verification_email, send_welcome_email
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_token,
    hash_password,
    hash_token,
    verify_password,
)

logger = logging.getLogger(__name__)

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
COOKIE_MAX_AGE_ACCESS = 15 * 60          # 15 min in seconds
COOKIE_MAX_AGE_REFRESH = 7 * 24 * 3600   # 7 days in seconds


def set_auth_cookies(response: Response, user_id: str) -> None:
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)

    domain = settings.cookie_domain if settings.cookie_domain else None
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=access_token,
        max_age=COOKIE_MAX_AGE_ACCESS,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
        domain=domain,
    )
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh_token,
        max_age=COOKIE_MAX_AGE_REFRESH,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
        domain=domain,
    )


def clear_auth_cookies(response: Response) -> None:
    domain = settings.cookie_domain if settings.cookie_domain else None
    response.delete_cookie(ACCESS_COOKIE, path="/", domain=domain, secure=settings.cookie_secure)
    response.delete_cookie(REFRESH_COOKIE, path="/", domain=domain, secure=settings.cookie_secure)


_VERIFY_EMAIL_PREFIX = "verify_email"
_VERIFY_EMAIL_TTL = 24 * 60 * 60  # 24 hours in seconds


async def register_user(data: RegisterRequest, db: Session) -> dict:
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.flush()  # get user.id

    subscription = Subscription(
        user_id=user.id,
        plan=SubscriptionPlan.FREE,
        status=SubscriptionStatus.ACTIVE,
        current_period_start=datetime.now(timezone.utc),
        current_period_end=datetime.now(timezone.utc) + timedelta(days=30),
    )
    db.add(subscription)
    db.commit()
    db.refresh(user)

    # Generate a one-time email verification token and store its hash in Redis.
    token = generate_token()
    token_hash = hash_token(token)
    await store_token(_VERIFY_EMAIL_PREFIX, token_hash, str(user.id), _VERIFY_EMAIL_TTL)

    # Send verification email. A failure here must not abort registration.
    try:
        send_verification_email(user.email, token)
    except Exception as exc:
        logger.error(f"Could not send verification email for user {user.id}: {exc}")

    logger.info(f"User registered: {user.id}")
    return {"message": "Registration successful. Please check your email to verify your account."}


def login_user(data: LoginRequest, db: Session, response: Response) -> UserResponse:
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not user.password_hash or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    set_auth_cookies(response, str(user.id))
    logger.info(f"User logged in: {user.id}")
    return UserResponse.model_validate(user)


def refresh_tokens(refresh_token: str, db: Session, response: Response) -> dict:
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    set_auth_cookies(response, str(user.id))
    return {"message": "Tokens refreshed"}


def logout_user(response: Response) -> dict:
    clear_auth_cookies(response)
    return {"message": "Logged out successfully"}


async def verify_email_user(token: str, db: Session, response: Response) -> dict:
    """Verify a user's email address using the one-time token."""
    token_hash = hash_token(token)
    user_id = await get_token_user(_VERIFY_EMAIL_PREFIX, token_hash)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        # Token was valid but user no longer exists — clean up and reject.
        await delete_token(_VERIFY_EMAIL_PREFIX, token_hash)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )

    # Mark as verified and consume the token atomically.
    user.is_verified = True
    db.commit()
    await delete_token(_VERIFY_EMAIL_PREFIX, token_hash)

    set_auth_cookies(response, str(user.id))

    logger.info(f"Email verified for user {user.id}")

    # Send welcome email — fire and forget (failure does not affect response).
    #TODO: Will see, do we need these letter or not.
    # try:
    #     send_welcome_email(user.email)
    # except Exception as exc:
    #     logger.error(f"Could not send welcome email for user {user.id}: {exc}")

    return {"message": "Email verified successfully"}


_RESET_PASSWORD_PREFIX = "reset_password"
_RESET_PASSWORD_TTL = 60 * 60  # 1 hour in seconds
_RESET_PASSWORD_SAFE_MESSAGE = "If that email exists, we sent a reset link"


async def forgot_password(data: ForgotPasswordRequest, db: Session) -> dict:
    """Initiate password reset. Always returns the same message to avoid email enumeration."""
    user = db.query(User).filter(User.email == data.email).first()

    if not user:
        return {"message": _RESET_PASSWORD_SAFE_MESSAGE}

    token = generate_token()
    token_hash = hash_token(token)
    await store_token(_RESET_PASSWORD_PREFIX, token_hash, str(user.id), _RESET_PASSWORD_TTL)

    try:
        send_password_reset_email(user.email, token)
    except Exception as exc:
        logger.error(f"Could not send password reset email for user {user.id}: {exc}")

    logger.info(f"Password reset requested for user {user.id}")
    return {"message": _RESET_PASSWORD_SAFE_MESSAGE}


async def reset_password(data: ResetPasswordRequest, db: Session) -> dict:
    """Consume a one-time reset token and update the user's password."""
    token_hash = hash_token(data.token)
    user_id = await get_token_user(_RESET_PASSWORD_PREFIX, token_hash)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        # Token was valid but user no longer exists — clean up and reject.
        await delete_token(_RESET_PASSWORD_PREFIX, token_hash)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    user.password_hash = hash_password(data.password)
    db.commit()

    # Consume the token — one-time use only.
    await delete_token(_RESET_PASSWORD_PREFIX, token_hash)

    logger.info(f"Password reset successfully for user {user.id}")
    return {"message": "Password reset successfully"}


def change_password(data: ChangePasswordRequest, user: User, db: Session) -> dict:
    """Change password for an email/password user after verifying the current password."""
    if user.auth_provider != AuthProvider.EMAIL or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password change is not available for accounts using social login",
        )

    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    user.password_hash = hash_password(data.new_password)
    db.commit()

    logger.info(f"Password changed for user {user.id}")
    return {"message": "Password changed successfully"}
