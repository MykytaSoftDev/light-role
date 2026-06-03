import logging
from typing import Optional

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.utils.security import decode_token

logger = logging.getLogger(__name__)


def get_current_user(
    db: Session = Depends(get_db),
    access_token: Optional[str] = Cookie(default=None),
) -> User:
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = decode_token(access_token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Session-revocation (security TASK 3): reject tokens whose ``tv`` claim
    # no longer matches the user's current token_version. A missing claim
    # (legacy token issued before this feature) compares unequal to the int
    # and is likewise rejected — those users simply re-login.
    if payload.get("tv") != user.token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked",
        )
    return user


def get_verified_user(current_user: User = Depends(get_current_user)) -> User:
    """Like get_current_user but also requires email verification."""
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required",
        )
    return current_user
