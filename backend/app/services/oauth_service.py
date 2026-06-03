import base64
import hashlib
import logging
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, Response
from jose import jwt
from jose.exceptions import JWTError
from sqlalchemy.orm import Session

from app.config import settings
from app.models.enums import AuthProvider, SubscriptionStatus
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.user import User
from app.redis import redis_delete, redis_get, redis_set
from app.schemas.user import UserResponse
from app.services.auth_service import set_auth_cookies

logger = logging.getLogger(__name__)

GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"

# Accepted issuers for Google-signed ID tokens.
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}

# Server-side state binding (oauth-state-pkce). The `state` nonce maps to the
# PKCE code_verifier in Redis so the callback can complete the exchange. Short
# TTL: the user must finish consent within this window.
OAUTH_STATE_PREFIX = "oauth:google"
OAUTH_STATE_TTL_SECONDS = 600  # 10 minutes

# Short-lived cookie carrying the `state` nonce back to the callback. Lets us
# bind the browser that *started* the flow to the one that completes it
# (defeats login-CSRF). httpOnly + SameSite=Lax + Secure (per settings).
STATE_COOKIE = "g_oauth_state"
STATE_COOKIE_MAX_AGE = OAUTH_STATE_TTL_SECONDS

# In-process JWKS cache for Google's signing certs. Google rotates these keys
# periodically; we refetch when the cache expires or a token's `kid` is absent
# (handles rotation between refreshes).
_jwks_cache: dict[str, Any] = {"keys": None, "fetched_at": 0.0}
_JWKS_TTL_SECONDS = 3600  # 1 hour


def _b64url_no_pad(raw: bytes) -> str:
    """Base64url-encode without padding (RFC 7636 PKCE / RFC 4648 §5)."""
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _generate_pkce_pair() -> tuple[str, str]:
    """Return (code_verifier, code_challenge) for the S256 PKCE method.

    code_verifier: high-entropy random string (43-128 chars).
    code_challenge: BASE64URL(SHA256(code_verifier)), no padding.
    """
    code_verifier = secrets.token_urlsafe(64)
    challenge_digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    code_challenge = _b64url_no_pad(challenge_digest)
    return code_verifier, code_challenge


async def build_google_authorize_url() -> tuple[str, str]:
    """Begin the Google OAuth flow.

    Mints a random `state` nonce and a PKCE verifier/challenge pair, stores
    the (state -> code_verifier) binding in Redis with a short TTL, and builds
    the Google authorization URL with the SERVER-pinned redirect_uri.

    Returns ``(authorize_url, state)``. The caller (router) sets `state` in
    the ``g_oauth_state`` cookie so the callback can prove the same browser
    completed the flow.
    """
    if not settings.google_client_id:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured")

    state = secrets.token_urlsafe(32)
    code_verifier, code_challenge = _generate_pkce_pair()

    stored = await redis_set(
        f"{OAUTH_STATE_PREFIX}:{state}",
        code_verifier,
        ttl_seconds=OAUTH_STATE_TTL_SECONDS,
    )
    if not stored:
        # Redis unavailable — fail closed. Without the stored verifier the
        # callback could never complete PKCE, so do not hand out a URL that
        # is guaranteed to fail (and would skip the security binding).
        raise HTTPException(
            status_code=503,
            detail="Unable to start Google sign-in. Please try again.",
        )

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        # Force the account chooser; we do not request offline access since
        # we verify identity via the id_token and need no refresh token.
        "access_type": "online",
        "prompt": "select_account",
    }
    authorize_url = f"{GOOGLE_AUTHORIZE_URL}?{urlencode(params)}"
    return authorize_url, state


async def _fetch_google_jwks(force: bool = False) -> list[dict[str, Any]]:
    """Return Google's JWKS, refetching past TTL (or when forced)."""
    now = time.monotonic()
    cached = _jwks_cache["keys"]
    if (
        not force
        and cached is not None
        and (now - _jwks_cache["fetched_at"]) < _JWKS_TTL_SECONDS
    ):
        return cached

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(GOOGLE_CERTS_URL)
    if resp.status_code != 200:
        logger.warning("Google JWKS fetch failed: status=%d", resp.status_code)
        if cached is not None:
            # Serve the stale cache rather than failing the whole login if a
            # transient fetch error happens mid-rotation.
            return cached
        raise HTTPException(status_code=502, detail="Unable to verify Google identity")

    keys = resp.json().get("keys", [])
    _jwks_cache["keys"] = keys
    _jwks_cache["fetched_at"] = now
    return keys


async def _verify_google_id_token(id_token: str) -> dict[str, Any]:
    """Verify a Google-issued ID token and return its claims.

    Checks signature against Google's JWKS, ``aud == google_client_id``,
    ``iss`` in the accepted Google issuers, and expiry. Raises HTTPException
    on any failure.
    """
    try:
        header = jwt.get_unverified_header(id_token)
    except JWTError as exc:
        logger.warning("Malformed Google id_token header: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid Google identity token")

    kid = header.get("kid")
    if not kid:
        raise HTTPException(status_code=400, detail="Invalid Google identity token")

    keys = await _fetch_google_jwks()
    signing_key = next((k for k in keys if k.get("kid") == kid), None)
    if signing_key is None:
        # Key id not found — Google may have rotated keys. Force a refetch
        # once before giving up.
        keys = await _fetch_google_jwks(force=True)
        signing_key = next((k for k in keys if k.get("kid") == kid), None)
    if signing_key is None:
        raise HTTPException(status_code=400, detail="Unable to verify Google identity token")

    try:
        claims = jwt.decode(
            id_token,
            signing_key,
            algorithms=["RS256"],
            audience=settings.google_client_id,
            # python-jose validates a single issuer string; we check the
            # broader accepted set manually below.
            options={"verify_iss": False},
        )
    except JWTError as exc:
        logger.warning("Google id_token verification failed: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid Google identity token")

    if claims.get("iss") not in GOOGLE_ISSUERS:
        logger.warning("Google id_token has unexpected issuer: %r", claims.get("iss"))
        raise HTTPException(status_code=400, detail="Invalid Google identity token")

    return claims


async def google_oauth_login(
    code: str, state: str, db: Session, response: Response, state_cookie: Optional[str]
) -> UserResponse:
    """Complete the Google OAuth flow (callback).

    Validates the `state` binding (cookie + Redis, single-use), exchanges the
    authorization code with PKCE against the SERVER-pinned redirect_uri,
    verifies the returned id_token, and logs the user in.
    """
    # 0. Validate state BEFORE any network/token exchange (cheap reject).
    #    The state must (a) match the cookie set by /start in this browser and
    #    (b) still exist in Redis. We pop the Redis entry to make it single-use.
    if not state or not state_cookie or not secrets.compare_digest(state, state_cookie):
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    code_verifier = await redis_get(f"{OAUTH_STATE_PREFIX}:{state}")
    # Always clear the cookie once we've started consuming the state.
    _clear_state_cookie(response)
    if not code_verifier:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    # Single-use: delete the binding so a captured state cannot be replayed.
    await redis_delete(f"{OAUTH_STATE_PREFIX}:{state}")

    # 1. Exchange authorization code for Google tokens using PKCE and the
    #    server-pinned redirect_uri (NOT a client-supplied value).
    async with httpx.AsyncClient(timeout=15.0) as client:
        token_response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
                "code_verifier": code_verifier,
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
    id_token = tokens.get("id_token")
    if not id_token:
        raise HTTPException(
            status_code=400,
            detail="Google did not return an identity token",
        )

    # 2. Verify the id_token (signature, aud, iss, exp) and derive identity
    #    from the VERIFIED claims — not the unauthenticated userinfo endpoint.
    claims = await _verify_google_id_token(id_token)

    google_id: str | None = claims.get("sub")
    email: str = (claims.get("email") or "").lower().strip()
    first_name: str | None = claims.get("given_name")
    last_name: str | None = claims.get("family_name")

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

            free_plan: Plan | None = db.query(Plan).filter(Plan.code == "free").first()
            if free_plan is None:
                raise HTTPException(
                    status_code=500,
                    detail="Free plan not found. Please contact support.",
                )

            subscription = Subscription(
                user_id=user.id,
                plan_id=free_plan.id,
                status=SubscriptionStatus.ACTIVE,
                current_period_start=datetime.now(timezone.utc),
                current_period_end=datetime.now(timezone.utc) + timedelta(days=30),
            )
            db.add(subscription)
            logger.info("Created new user via Google OAuth: %s", user.id)

    # SPEC §4.7: track last_login_at on every successful login — both
    # first-time-via-Google (user was just created) and returning OAuth
    # users. Stored as naive UTC (column convention).
    user.last_login_at = datetime.now(timezone.utc).replace(tzinfo=None)

    db.commit()
    db.refresh(user)

    set_auth_cookies(response, user)
    logger.info("Google OAuth login successful: user %s", user.id)
    return UserResponse.model_validate(user)


def set_state_cookie(response: Response, state: str) -> None:
    """Set the short-lived httpOnly state cookie used to bind the browser."""
    response.set_cookie(
        key=STATE_COOKIE,
        value=state,
        max_age=STATE_COOKIE_MAX_AGE,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def _clear_state_cookie(response: Response) -> None:
    response.delete_cookie(
        STATE_COOKIE, path="/", secure=settings.cookie_secure
    )
