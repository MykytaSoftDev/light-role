"""
Rate limiting dependencies for FastAPI endpoints.

Uses Redis INCR + EXPIRE counters via the existing redis_increment_with_ttl
helper (which sets the TTL only on the first increment, avoiding a race
where a concurrent request resets the window).

Fail-open vs fail-closed:
    - General API / read traffic FAILS OPEN — if Redis is unreachable the
      request is allowed through so a cache outage does not take down the API.
    - Sensitive buckets (login, forgot-password, register) FAIL CLOSED — a
      Redis outage returns 503 Service Unavailable rather than silently
      disabling brute-force / enumeration protection.

Key schema
----------
rate_limit:login:{ip}        — 10 req / 5 min  (POST /auth/login)
rate_limit:forgot:{ip}       — 5 req  / 1 hour (POST /auth/forgot-password)
rate_limit:register:{ip}     — 10 req / 1 hour (POST /auth/register)
rate_limit:api:{user_or_ip}  — 100 req / 1 min (all other /api/v1/* routes)
"""

import logging
from typing import Optional

from fastapi import Cookie, HTTPException, Request, status

from app.redis import (
    RedisUnavailableError,
    check_rate_limit,
    check_rate_limit_strict,
    get_redis_client,
)

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────────────────────────────────────

def _get_client_ip(request: Request) -> str:
    """
    Return the real peer IP for rate-limiting purposes.

    We trust ONLY ``X-Real-IP``, which our nginx sets to ``$remote_addr``
    (the actual TCP peer) on both the app-host and api-host server blocks.
    The leftmost ``X-Forwarded-For`` entry is deliberately NOT used: nginx
    forwards it via ``$proxy_add_x_forwarded_for``, so its first hop is
    attacker-controlled and trivially spoofable to evade per-IP limits.

    Falls back to the direct connection address when ``X-Real-IP`` is
    absent (e.g. local/dev requests that don't pass through nginx), and to
    ``"unknown"`` only as a last resort.
    """
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        real_ip = real_ip.strip()
        if real_ip:
            return real_ip
    if request.client:
        return request.client.host
    return "unknown"


async def _enforce(key: str, limit: int, window_seconds: int, request: Request) -> None:
    """
    Increment the counter for *key* and raise HTTP 429 if *limit* is exceeded.

    The Retry-After header value is taken from the Redis TTL so the client
    knows exactly when its window resets.
    """
    allowed, _ = await check_rate_limit(key, limit, window_seconds)
    if not allowed:
        # Retrieve TTL for the Retry-After header.  Falls back to the window
        # duration if Redis is unavailable.
        retry_after = window_seconds
        try:
            redis = await get_redis_client()
            ttl = await redis.ttl(key)
            if ttl > 0:
                retry_after = ttl
        except Exception:
            pass  # fail open — use the window as a safe upper bound

        logger.warning(
            "Rate limit exceeded",
            extra={
                "key": key,
                "limit": limit,
                "window_seconds": window_seconds,
                "client_ip": _get_client_ip(request),
                "path": request.url.path,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "detail": "Too many requests. Please try again later.",
                "retry_after": retry_after,
            },
            headers={"Retry-After": str(retry_after)},
        )


async def _enforce_strict(
    key: str, limit: int, window_seconds: int, request: Request
) -> None:
    """
    Fail-CLOSED enforcement for sensitive buckets (login/forgot/register).

    Identical to :func:`_enforce` on the happy path, but if Redis is
    unreachable we DENY the request with HTTP 503 instead of allowing it.
    This keeps brute-force / enumeration protection in effect during a
    cache outage. 503 (not 429) is used because the failure is server-side
    (Redis down), not the client exceeding a limit — and ``Retry-After``
    signals the client to back off briefly.

    The Redis-down condition is logged once per occurrence at ERROR level
    (one log line per affected request is acceptable here — these buckets
    are low-volume; we are not at risk of log spam the way general API
    traffic would be).
    """
    try:
        allowed, _ = await check_rate_limit_strict(key, limit, window_seconds)
    except RedisUnavailableError as exc:
        logger.error(
            "Rate limit FAIL-CLOSED: Redis unavailable, denying request",
            extra={
                "key": key,
                "client_ip": _get_client_ip(request),
                "path": request.url.path,
                "error": str(exc),
            },
        )
        retry_after = 30
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "detail": "Service temporarily unavailable. Please try again shortly.",
                "retry_after": retry_after,
            },
            headers={"Retry-After": str(retry_after)},
        )

    if not allowed:
        retry_after = window_seconds
        try:
            redis = await get_redis_client()
            ttl = await redis.ttl(key)
            if ttl > 0:
                retry_after = ttl
        except Exception:
            pass  # use the window as a safe upper bound

        logger.warning(
            "Rate limit exceeded",
            extra={
                "key": key,
                "limit": limit,
                "window_seconds": window_seconds,
                "client_ip": _get_client_ip(request),
                "path": request.url.path,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "detail": "Too many requests. Please try again later.",
                "retry_after": retry_after,
            },
            headers={"Retry-After": str(retry_after)},
        )


# ──────────────────────────────────────────────────────────────────────────────
# Public dependency functions
# ──────────────────────────────────────────────────────────────────────────────

async def login_rate_limit(request: Request) -> None:
    """
    10 login attempts per 5 minutes per IP.

    Inject with ``Depends(login_rate_limit)`` on the login endpoint.
    Returns None on success; raises HTTP 429 on limit exceeded.
    """
    ip = _get_client_ip(request)
    key = f"rate_limit:login:{ip}"
    await _enforce_strict(key, limit=10, window_seconds=5 * 60, request=request)


async def forgot_password_rate_limit(request: Request) -> None:
    """
    5 password-reset requests per hour per IP.

    Ideally this would key on the submitted email address, but reading the
    request body inside a dependency is not safe (it consumes the stream).
    IP-based limiting is a reasonable proxy and prevents bulk-reset abuse.

    Inject with ``Depends(forgot_password_rate_limit)`` on the
    forgot-password endpoint.
    """
    ip = _get_client_ip(request)
    key = f"rate_limit:forgot:{ip}"
    await _enforce_strict(key, limit=5, window_seconds=60 * 60, request=request)


async def register_rate_limit(request: Request) -> None:
    """
    10 registration attempts per hour per IP.

    Prevents automated account creation from a single origin.
    Inject with ``Depends(register_rate_limit)`` on the register endpoint.
    """
    ip = _get_client_ip(request)
    key = f"rate_limit:register:{ip}"
    await _enforce_strict(key, limit=10, window_seconds=60 * 60, request=request)


async def general_api_rate_limit(
    request: Request,
    access_token: Optional[str] = Cookie(default=None),
) -> None:
    """
    100 requests per minute for general authenticated API routes.

    Keys on the access-token cookie value when present (identifies the user
    regardless of IP — important for users behind shared NAT).  Falls back to
    IP when no token is present (unauthenticated callers).

    Inject with ``Depends(general_api_rate_limit)`` on any endpoint that
    should be covered by the general quota.
    """
    identifier = access_token if access_token else _get_client_ip(request)
    key = f"rate_limit:api:{identifier}"
    await _enforce(key, limit=100, window_seconds=60, request=request)
