import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Any

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

from app.config import settings, validate_production_settings
from app.logging_config import setup_logging
from app.redis import close_redis, get_redis_client
from app.services.pdf_service import pdf_service
from app.tasks.scheduler import run_notification_scheduler
from app.routers import admin as admin_router
from app.routers import analytics as analytics_router
from app.routers import auth as auth_router
from app.routers import cover_letters as cover_letters_router
from app.routers import feedback as feedback_router
from app.routers import health
from app.routers import jobs as jobs_router
from app.routers import notifications as notifications_router
from app.routers import plans as plans_router
from app.routers import profile as profile_router
from app.routers import subscriptions as subscriptions_router
from app.routers import support as support_router
from app.routers import tailored_resumes as tailored_resumes_router
from app.routers import users as users_router
from app.routers import webhooks as webhooks_router

logger = logging.getLogger(__name__)


_REDACTED = "[redacted]"
# Substrings (case-insensitive) that mark a key as carrying a secret value.
_SENSITIVE_KEY_PARTS = ("password", "token", "secret", "api_key")


def _is_sensitive_key(key: Any) -> bool:
    if not isinstance(key, str):
        return False
    lowered = key.lower()
    return any(part in lowered for part in _SENSITIVE_KEY_PARTS)


def _scrub(value: Any) -> Any:
    """Recursively redact sensitive keys in dicts/lists found in an event."""
    if isinstance(value, dict):
        scrubbed: dict[Any, Any] = {}
        for k, v in value.items():
            if _is_sensitive_key(k):
                scrubbed[k] = _REDACTED
            else:
                scrubbed[k] = _scrub(v)
        return scrubbed
    if isinstance(value, list):
        return [_scrub(item) for item in value]
    return value


def _scrub_request(request: Any) -> None:
    """Redact cookies and the Authorization header on a Sentry request dict."""
    if not isinstance(request, dict):
        return
    if "cookies" in request:
        request["cookies"] = _REDACTED
    headers = request.get("headers")
    if isinstance(headers, dict):
        for header_key in list(headers.keys()):
            if isinstance(header_key, str) and header_key.lower() == "authorization":
                headers[header_key] = _REDACTED
            elif isinstance(header_key, str) and header_key.lower() == "cookie":
                headers[header_key] = _REDACTED
    # Form/JSON body and query string may also contain sensitive fields.
    if "data" in request:
        request["data"] = _scrub(request["data"])


def _before_send(event: dict[str, Any], hint: dict[str, Any]) -> dict[str, Any] | None:
    """Filter out 4xx client errors and redact PII before sending to Sentry.

    Keeps existing behavior: drop FastAPI/Starlette HTTP exceptions with 4xx
    status codes; let 5xx (and non-HTTP exceptions) through. Before returning
    a captured event, scrub request cookies, the Authorization header, and any
    field whose key contains password/token/secret/api_key.
    """
    if "exc_info" in hint:
        exc_type, exc_value, _ = hint["exc_info"]
        # Skip FastAPI/Starlette HTTP exceptions with 4xx status codes
        status_code = getattr(exc_value, "status_code", None)
        if status_code is not None and 400 <= status_code < 500:
            return None

    _scrub_request(event.get("request"))
    if "extra" in event:
        event["extra"] = _scrub(event["extra"])
    if "contexts" in event:
        event["contexts"] = _scrub(event["contexts"])

    return event


def setup_sentry() -> None:
    if not settings.sentry_dsn:
        logger.info("Sentry DSN not configured — skipping initialization")
        return
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.1,
        # Never attach default PII (request body, user IP, cookies). We also
        # scrub explicitly in _before_send as defense in depth.
        send_default_pii=False,
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
    # Abort boot before serving any traffic if production config is unsafe.
    # The RuntimeError propagates out of the lifespan, so uvicorn fails to
    # start (non-zero exit) instead of running with insecure settings.
    validate_production_settings()
    setup_sentry()
    await get_redis_client()
    # Pre-warm Chromium for PDF rendering (TAILOR-3). Failures are logged
    # inside `start()` and don't crash startup — `_ensure_browser()` will
    # retry-launch on the first render request.
    await pdf_service.start()
    scheduler_task = asyncio.create_task(run_notification_scheduler())
    logger.info("Application startup complete")
    yield
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass
    await pdf_service.stop()
    await close_redis()
    logger.info("Application shutdown complete")


def create_app() -> FastAPI:
    # Hide interactive API docs and the OpenAPI schema in production; they
    # remain available in dev/test for local exploration.
    is_production = settings.environment == "production"
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url=None if is_production else "/docs",
        redoc_url=None if is_production else "/redoc",
        openapi_url=None if is_production else "/openapi.json",
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
    app.include_router(cover_letters_router.router)
    app.include_router(notifications_router.router)
    app.include_router(plans_router.router)
    app.include_router(profile_router.router)
    app.include_router(subscriptions_router.router)
    app.include_router(tailored_resumes_router.router)
    app.include_router(webhooks_router.router)
    app.include_router(feedback_router.router)
    app.include_router(support_router.router)
    app.include_router(analytics_router.router)
    app.include_router(admin_router.router)

    # Static fonts served for the PDF render pipeline (TAILOR-5). Maps the
    # /app/fonts directory baked into the Docker image to /static/fonts so
    # the resume HTML can reference fonts via @font-face URL — Chromium
    # needs an HTTP origin (file:// is blocked from about:blank).
    #
    # Tolerate the directory not existing in dev/test environments where
    # the image hasn't been built — registering a missing-path mount would
    # otherwise crash app import on developer machines.
    fonts_dir = "/app/fonts"
    if os.path.isdir(fonts_dir):
        app.mount(
            "/static/fonts",
            StaticFiles(directory=fonts_dir),
            name="fonts",
        )
    else:
        logger.info(
            "PDF font directory %s not present — /static/fonts mount skipped. "
            "This is expected outside the Docker image.",
            fonts_dir,
        )

    return app


app = create_app()
