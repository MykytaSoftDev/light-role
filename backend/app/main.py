import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

from app.config import settings
from app.logging_config import setup_logging
from app.redis import close_redis, get_redis_client
from app.tasks.scheduler import run_notification_scheduler
from app.routers import auth as auth_router
from app.routers import cover_letters as cover_letters_router
from app.routers import health
from app.routers import jobs as jobs_router
from app.routers import notifications as notifications_router
from app.routers import plans as plans_router
from app.routers import resumes as resumes_router
from app.routers import subscriptions as subscriptions_router
from app.routers import users as users_router
from app.routers import webhooks as webhooks_router

logger = logging.getLogger(__name__)


def _before_send(event: dict[str, Any], hint: dict[str, Any]) -> dict[str, Any] | None:
    """Filter out 4xx client errors from Sentry (only track 5xx server errors)."""
    if "exc_info" in hint:
        exc_type, exc_value, _ = hint["exc_info"]
        # Skip FastAPI/Starlette HTTP exceptions with 4xx status codes
        status_code = getattr(exc_value, "status_code", None)
        if status_code is not None and 400 <= status_code < 500:
            return None
    return event


def setup_sentry() -> None:
    if not settings.sentry_dsn:
        logger.info("Sentry DSN not configured — skipping initialization")
        return
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.1,
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
        ],
        before_send=_before_send,
    )
    logger.info("Sentry initialized")


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(log_dir="logs", environment=settings.environment)
    setup_sentry()
    await get_redis_client()
    scheduler_task = asyncio.create_task(run_notification_scheduler())
    logger.info("Application startup complete")
    yield
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass
    await close_redis()
    logger.info("Application shutdown complete")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_url.rstrip("/")],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )

    app.include_router(health.router, prefix="/api")
    app.include_router(auth_router.router)
    app.include_router(users_router.router)
    app.include_router(jobs_router.router)
    app.include_router(resumes_router.router)
    app.include_router(cover_letters_router.router)
    app.include_router(notifications_router.router)
    app.include_router(plans_router.router)
    app.include_router(subscriptions_router.router)
    app.include_router(webhooks_router.router)

    return app


app = create_app()
