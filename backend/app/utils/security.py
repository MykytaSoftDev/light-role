import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from app.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, token_version: int) -> str:
    # ``tv`` (token_version) carries the user's session-revocation counter
    # (security TASK 3). Auth dependencies reject the token if this claim
    # does not match the user's current ``token_version``.
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": "access", "tv": token_version},
        settings.secret_key,
        algorithm=settings.algorithm,
    )


def create_refresh_token(user_id: str, token_version: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": "refresh", "tv": token_version},
        settings.secret_key,
        algorithm=settings.algorithm,
    )


def create_impersonation_token(
    target_user_id: str, admin_user_id: str, target_token_version: int
) -> str:
    """Mint a 60-min access token tagged with ``is_impersonating=true``
    (SPEC §6.3).

    Carries an extra ``impersonator_id`` claim so middleware can identify
    the admin behind the request without re-reading cookies. The token's
    ``sub`` is the *target* user — every downstream dependency that resolves
    the "current user" from ``sub`` therefore acts as the impersonated
    user, which is the intended behaviour.

    No refresh path — when this 60-min token expires the admin must exit
    impersonation (or click Impersonate again). The frontend warns at
    T-5min via toast (SPEC §6.3).

    ``tv`` carries the TARGET user's ``token_version`` (sub is the target),
    so the impersonation session is revoked the moment the target's
    token_version is bumped — exactly like a real session for that user.
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=60)
    return jwt.encode(
        {
            "sub": target_user_id,
            "exp": expire,
            "type": "access",
            "is_impersonating": True,
            "impersonator_id": admin_user_id,
            "tv": target_token_version,
        },
        settings.secret_key,
        algorithm=settings.algorithm,
    )


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
