"""
Redis-backed task status store for background resume analysis jobs.

Key schema: resume_analysis:{task_id}
TTL: 1 hour (sufficient for polling; completed tasks are read once and discarded)
"""
from __future__ import annotations

import json
import logging

from app.redis import redis_get, redis_set

logger = logging.getLogger(__name__)

ANALYSIS_TASK_TTL = 3600  # 1 hour


def _task_key(task_id: str) -> str:
    return f"resume_analysis:{task_id}"


async def create_task(
    task_id: str,
    resume_id: str,
    job_id: str,
    user_id: str,
) -> None:
    """Write an initial 'pending' task record to Redis."""
    data = {
        "status": "pending",
        "resume_id": resume_id,
        "job_id": job_id,
        "user_id": user_id,
        "error": None,
    }
    await redis_set(_task_key(task_id), json.dumps(data), ANALYSIS_TASK_TTL)
    logger.debug("Analysis task created: task_id=%s resume_id=%s", task_id, resume_id)


async def get_task_status(task_id: str) -> dict | None:
    """Return the task dict or None if not found / expired."""
    raw = await redis_get(_task_key(task_id))
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except Exception as exc:
        logger.error("Failed to deserialise task status: task_id=%s error=%s", task_id, exc)
        return None


async def update_task_status(
    task_id: str,
    status: str,
    error: str | None = None,
) -> None:
    """Update the status (and optionally error) of an existing task."""
    existing = await get_task_status(task_id)
    if existing is None:
        logger.warning("update_task_status called for unknown task_id=%s", task_id)
        return
    existing["status"] = status
    if error is not None:
        existing["error"] = error
    await redis_set(_task_key(task_id), json.dumps(existing), ANALYSIS_TASK_TTL)
    logger.debug("Analysis task updated: task_id=%s status=%s", task_id, status)
