import logging
import time
from datetime import datetime
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


# Per-credit cycle-scoped usage counters (MONETIZE-3).
#
# Key layout: ``usage:{user_id}:{credit_type}:{cycle_start_iso}``
#   - credit_type ∈ {"resume_credit", "cl_credit"} (matches usage_log.cost_type)
#   - cycle_start_iso is the ISO-8601 string of the cycle window start
#
# Encoding the cycle_start in the key means a fresh cycle simply produces a
# new key — old cycle counters expire naturally via TTL without us needing
# any cross-cycle reset logic. Per-cycle TTL is 1 hour by default; cache
# misses recount from `usage_log` on the next quota check.

def _credit_usage_key(user_id: str, credit_type: str, cycle_start: datetime) -> str:
    return f"usage:{user_id}:{credit_type}:{cycle_start.isoformat()}"


async def get_credit_usage(
    user_id: str, credit_type: str, cycle_start: datetime
) -> Optional[int]:
    """Return cached credit count for the given cycle, or ``None`` on miss/error.

    Distinguishes "not cached" (None) from "zero usage" (0) so the caller
    can decide to recount from `usage_log` only on a true miss.
    """
    key = _credit_usage_key(user_id, credit_type, cycle_start)
    try:
        client = await get_redis_client()
        value = await client.get(key)
    except RedisError as e:
        logger.error(f"Redis GET error for credit-usage key '{key}': {e}")
        return None
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        logger.warning(f"Non-integer value cached at '{key}': {value!r}")
        return None


async def set_credit_usage(
    user_id: str,
    credit_type: str,
    cycle_start: datetime,
    value: int,
    ttl: int = 3600,
) -> bool:
    """Cache the credit count for the current cycle.

    TTL is short by design — it only protects against `usage_log` recount
    storms. Old-cycle keys are unique (cycle_start is in the key), so they
    never need explicit invalidation.
    """
    key = _credit_usage_key(user_id, credit_type, cycle_start)
    return await redis_set(key, str(value), ttl)


async def increment_credit_usage(
    user_id: str, credit_type: str, cycle_start: datetime
) -> Optional[int]:
    """Atomically increment the credit counter for the current cycle.

    Returns the new value, or ``None`` on Redis error. If the key doesn't
    exist yet, INCR initialises it to 1 — but the value is most useful
    when the cache was already warmed by the dependency's recount path.
    Sets a fresh 1-hour TTL on first increment.
    """
    key = _credit_usage_key(user_id, credit_type, cycle_start)
    return await redis_increment_with_ttl(key, ttl_seconds=3600)


# ─────────────────────────────────────────────
# AI generation sliding-window rate limit (MONETIZE-5)
# ─────────────────────────────────────────────
#
# Key layout:
#   rate_limit:ai_gen:{user_id}  — sorted set of epoch-second timestamps
#                                   for each successful AI generation
#   block:ai_gen:{user_id}       — string sentinel with TTL; presence
#                                   forces deny regardless of the sliding
#                                   window's natural decay
#
# Semantics:
#   - Sliding window via ZSET + ZREMRANGEBYSCORE drops timestamps older
#     than (now - window_seconds) before counting.
#   - Once the cap is hit we set the block flag with TTL = block_duration.
#     Without the block, a single timestamp aging out would immediately
#     re-enable a blocked abuser — the block is what keeps the lockout
#     "sticky" for the configured duration.
#   - These helpers RAISE on Redis errors. The caller (a FastAPI
#     dependency) decides whether to fail open (most common — log + allow)
#     or fail closed.

def _ai_gen_rate_key(user_id: str) -> str:
    return f"rate_limit:ai_gen:{user_id}"


def _ai_gen_block_key(user_id: str) -> str:
    return f"block:ai_gen:{user_id}"


async def ai_gen_rate_limit_check(
    user_id: str, limit: int, window_seconds: int
) -> tuple[bool, int, Optional[int]]:
    """Check the sliding-window cap + block flag for *user_id*.

    Returns ``(allowed, current_count, retry_after_seconds_or_None)``.

    - If the block flag exists and has positive TTL, the user is locked
      out: returns ``(False, -1, ttl_seconds)``. ``current_count`` is
      ``-1`` because we deliberately skip the ZSET read in the
      blocked-path (saves a round trip; the count is irrelevant once we
      know we're returning False).
    - Otherwise we trim the ZSET to ``[now - window, now]`` via
      ZREMRANGEBYSCORE, ZCARD the remainder, and return
      ``(count < limit, count, None)``.

    Raises ``RedisError`` on transport/protocol failures so the caller
    can decide on fail-open vs fail-closed semantics.
    """
    block_key = _ai_gen_block_key(user_id)
    rate_key = _ai_gen_rate_key(user_id)
    client = await get_redis_client()

    # Block flag short-circuit. ttl returns -2 when the key doesn't exist
    # and -1 when it exists with no TTL (shouldn't happen here since we
    # always SETEX, but defend anyway).
    block_ttl = await client.ttl(block_key)
    if isinstance(block_ttl, int) and block_ttl > 0:
        return False, -1, block_ttl

    now = int(time.time())
    cutoff = now - window_seconds

    # Drop expired timestamps, then count what remains.
    await client.zremrangebyscore(rate_key, 0, cutoff)
    count = await client.zcard(rate_key)
    count_int = int(count) if count is not None else 0

    return count_int < limit, count_int, None


async def ai_gen_rate_limit_record(user_id: str, window_seconds: int) -> None:
    """Record one successful AI generation in the sliding window.

    ZADD a ``now`` timestamp keyed under both score and member (so two
    inserts in the same epoch-second collapse — fine, we'd rather
    under-count than over-count). The key TTL is set to ``window * 2``
    so abandoned keys age out automatically without the active code path
    having to clean them up.

    Raises ``RedisError`` on failure — caller decides whether to swallow.
    """
    rate_key = _ai_gen_rate_key(user_id)
    client = await get_redis_client()
    now = int(time.time())
    # Use the timestamp as both score AND member. Same-second duplicates
    # become a no-op insert — acceptable approximation.
    await client.zadd(rate_key, {str(now): now})
    await client.expire(rate_key, window_seconds * 2)


async def ai_gen_rate_limit_block(user_id: str, block_seconds: int) -> None:
    """Set the block sentinel with TTL = ``block_seconds``.

    Once set, ``ai_gen_rate_limit_check`` returns ``allowed=False`` for
    the entire duration regardless of how many timestamps decay out of
    the sliding window in the meantime. This is what makes the rate
    limit "sticky" instead of jittery.

    Raises ``RedisError`` on failure.
    """
    block_key = _ai_gen_block_key(user_id)
    client = await get_redis_client()
    await client.setex(block_key, block_seconds, "1")
