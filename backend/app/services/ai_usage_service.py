from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.ai.interface import AIUsageInfo
from app.models.enums import OperationType
from app.models.usage_log import UsageLog

logger = logging.getLogger(__name__)


def log_ai_operation(
    db: Session,
    user_id: UUID,
    operation_type: OperationType,
    usage: AIUsageInfo,
) -> UsageLog:
    """Create and persist a UsageLog record for a completed AI operation."""
    log = UsageLog(
        user_id=user_id,
        operation_type=operation_type,
        ai_model=usage.model,
        tokens_input=usage.tokens_input,
        tokens_output=usage.tokens_output,
        response_time_ms=usage.response_time_ms,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    logger.info(
        "AI operation logged: user=%s operation=%s model=%s tokens_in=%d tokens_out=%d",
        user_id,
        operation_type.value,
        usage.model,
        usage.tokens_input,
        usage.tokens_output,
    )
    return log
