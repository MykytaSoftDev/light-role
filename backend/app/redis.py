import logging
from typing import Optional

import redis.asyncio as aioredis
from redis.asyncio import Redis
from redis.exceptions import ConnectionError, RedisError, TimeoutError

from app.config import settings

logger = logging.getLogger(__name__)

_redis_client: Optional[Redis] = None


async def get_redis_client() -> Redis:
    """Get or create Redis client (singleton)."""
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30,
        )
        logger.info("Redis client initialized")
    return _redis_client


async def check_redis_connection() -> bool:
    """Check Redis connectivity for health endpoint."""
    try:
        client = await get_redis_client()
        await client.ping()
        return True
    except (ConnectionError, TimeoutError, RedisError) as e:
        logger.warning(f"Redis health check failed: {e}")
        return False


async def close_redis() -> None:
    """Close Redis connection on shutdown."""
    global _redis_client
    if _redis_client:
        await _redis_client.aclose()
        _redis_client = None
        logger.info("Redis connection closed")


# ─────────────────────────────────────────────
# Generic key/value utilities
# ─────────────────────────────────────────────

async def redis_get(key: str) -> Optional[str]:
    """Get a value by key. Returns None if key doesn't exist or on error."""
    try:
        client = await get_redis_client()
        return await client.get(key)
    except RedisError as e:
        logger.error(f"Redis GET error for key '{key}': {e}")
        return None


async def redis_set(key: str, value: str, ttl_seconds: Optional[int] = None) -> bool:
    """Set a key with optional TTL. Returns True on success."""
    try:
        client = await get_redis_client()
        if ttl_seconds is not None:
            await client.setex(key, ttl_seconds, value)
        else:
            await client.set(key, value)
        return True
    except RedisError as e:
        logger.error(f"Redis SET error for key '{key}': {e}")
        return False


async def redis_delete(key: str) -> bool:
    """Delete a key. Returns True on success."""
    try:
        client = await get_redis_client()
        await client.delete(key)
        return True
    except RedisError as e:
        logger.error(f"Redis DELETE error for key '{key}': {e}")
        return False


async def redis_expire(key: str, ttl_seconds: int) -> bool:
    """Set TTL on an existing key. Returns True on success."""
    try:
        client = await get_redis_client()
        return bool(await client.expire(key, ttl_seconds))
    except RedisError as e:
        logger.error(f"Redis EXPIRE error for key '{key}': {e}")
        return False


async def redis_increment(key: str, amount: int = 1) -> Optional[int]:
    """Increment a counter. Returns new value, or None on error."""
    try:
        client = await get_redis_client()
        return await client.incrby(key, amount)
    except RedisError as e:
        logger.error(f"Redis INCR error for key '{key}': {e}")
        return None


async def redis_increment_with_ttl(
    key: str, ttl_seconds: int, amount: int = 1
) -> Optional[int]:
    """Increment a counter, setting TTL only on first increment (key didn't exist).
    Used for rate limiting and usage counters.
    """
    try:
        client = await get_redis_client()
        pipe = client.pipeline()
        await pipe.incrby(key, amount)
        await pipe.ttl(key)
        results = await pipe.execute()
        new_value: int = results[0]
        current_ttl: int = results[1]
        # Set TTL only if the key is new (TTL == -1 means no expiry set)
        if current_ttl == -1:
            await client.expire(key, ttl_seconds)
        return new_value
    except RedisError as e:
        logger.error(f"Redis INCR+TTL error for key '{key}': {e}")
        return None


# ─────────────────────────────────────────────
# Domain-specific helpers (Redis Key Schema)
# ─────────────────────────────────────────────

# Token operations (email verification, password reset)
async def store_token(prefix: str, token_hash: str, user_id: str, ttl_seconds: int) -> bool:
    """Store a hashed token → user_id mapping with TTL."""
    key = f"{prefix}:{token_hash}"
    return await redis_set(key, user_id, ttl_seconds)


async def get_token_user(prefix: str, token_hash: str) -> Optional[str]:
    """Retrieve user_id for a token hash. Returns None if expired or not found."""
    key = f"{prefix}:{token_hash}"
    return await redis_get(key)


async def delete_token(prefix: str, token_hash: str) -> bool:
    """Delete a token (single-use enforcement)."""
    key = f"{prefix}:{token_hash}"
    return await redis_delete(key)


# Rate limiting helpers
async def check_rate_limit(key: str, limit: int, ttl_seconds: int) -> tuple[bool, int]:
    """
    Check and increment a rate limit counter.
    Returns (is_allowed, current_count).
    is_allowed=False means the limit has been exceeded.
    """
    new_count = await redis_increment_with_ttl(key, ttl_seconds)
    if new_count is None:
        # Redis error — fail open (allow request)
        return True, 0
    return new_count <= limit, new_count


# AI usage counter helpers
async def get_usage_count(user_id: str, year_month: str) -> int:
    """Get current AI operation count for a user in a given month (YYYY-MM)."""
    key = f"usage:{user_id}:{year_month}"
    value = await redis_get(key)
    return int(value) if value else 0


async def increment_usage_count(user_id: str, year_month: str) -> Optional[int]:
    """Increment AI usage counter. Sets 40-day TTL on first increment."""
    key = f"usage:{user_id}:{year_month}"
    ttl_40_days = 40 * 24 * 60 * 60
    return await redis_increment_with_ttl(key, ttl_40_days)
