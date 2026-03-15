from fastapi import APIRouter

from app.config import settings
from app.database import check_db_connection
from app.redis import check_redis_connection
from app.schemas.common import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check():
    db_ok = check_db_connection()
    redis_ok = await check_redis_connection()

    return HealthResponse(
        status="ok",
        db="connected" if db_ok else "disconnected",
        redis="connected" if redis_ok else "disconnected",
        environment=settings.environment,
    )
