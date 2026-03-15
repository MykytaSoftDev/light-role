import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, Response, status
from sqlalchemy.orm import Session

from app.models.enums import SubscriptionPlan, SubscriptionStatus
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest
from app.schemas.user import UserResponse
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
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

    response.set_cookie(
        key=ACCESS_COOKIE,
        value=access_token,
        max_age=COOKIE_MAX_AGE_ACCESS,
        httponly=True,
        secure=False,   # set True in production
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh_token,
        max_age=COOKIE_MAX_AGE_REFRESH,
        httponly=True,
        secure=False,   # set True in production
        samesite="lax",
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path="/")


def register_user(data: RegisterRequest, db: Session, response: Response) -> UserResponse:
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

    set_auth_cookies(response, str(user.id))
    logger.info(f"User registered: {user.id}")
    return UserResponse.model_validate(user)


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
