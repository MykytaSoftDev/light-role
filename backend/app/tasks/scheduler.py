"""
Background notification scheduler.

Runs `generate_all_notifications` once on startup and then every 24 hours.
Started as an asyncio Task inside the FastAPI lifespan context manager.
Errors are caught and logged so a transient DB/Redis failure never kills
the scheduler loop.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from app.database import SessionLocal
from app.services.notification_generator import generate_all_notifications

logger = logging.getLogger(__name__)

_INTERVAL_SECONDS = 24 * 60 * 60  # 24 hours


async def run_notification_scheduler() -> None:
    """Background task that runs notification generation every 24 hours."""
    while True:
        now = datetime.now(timezone.utc)
        logger.info(
            "Running scheduled notification generation: timestamp=%s",
            now.isoformat(),
        )
        db = SessionLocal()
        try:
            results = await generate_all_notifications(db)
            logger.info(
                "Notification generation complete: %s",
                results,
            )
        except Exception as exc:
            logger.error(
                "Notification scheduler error: %s",
                exc,
                exc_info=True,
            )
        finally:
            db.close()

        await asyncio.sleep(_INTERVAL_SECONDS)
