from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "Light Role API"
    debug: bool = False
    environment: str = "development"

    # Database
    database_url: str = "postgresql://lightrole:lightrole@localhost:5432/lightrole"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 120
    refresh_token_expire_days: int = 7

    # CORS
    frontend_url: str = "https://dev.lightrole.com"
    cookie_secure: bool = False
    cookie_domain: str = ""

    # OpenAI
    openai_api_key: str = ""
    ai_model_parse_resume: str = "gpt-4o-mini"
    ai_model_tailor_resume: str = "gpt-4o-mini"
    # CL-1: 3-variant cover letter generation. Default mirrors the other
    # AI ops; override via OPENAI_COVER_LETTER_MODEL or AI_MODEL_COVER_LETTER
    # in the environment.
    ai_model_cover_letter: str = "gpt-4o-mini"

    # Resend
    resend_api_key: str = ""
    resend_from_email: str = ""
    support_email: str = "support@lightrole.com"

    # Sentry
    sentry_dsn: str = ""

    # File storage
    uploads_dir: str = "/uploads"
    max_file_size_mb: int = 10

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""

    # Analytics
    # Bump this on any change to the AnalyticsResponse wire shape so
    # already-cached entries are invalidated transparently. The cache key
    # pattern is `analytics:v{version}:{user_id}:{period}`.
    # v2 (2026-05-11): ActivityEvent gained structured company/role/to_status
    # fields so the frontend can localize the activity feed.
    analytics_cache_version: int = 2

    # PDF rendering (TAILOR-3)
    # Hard cap on a single page.pdf() render. Chromium occasionally hangs on
    # font-loading or networkidle waits — 20s is generous for a resume but
    # short enough to surface real failures as 504 instead of dragging on.
    pdf_render_timeout_seconds: int = 20
    # Recycle the singleton browser after this many successful renders to
    # bound memory growth (Chromium leaks ~5-10MB per long-running session).
    pdf_browser_recycle_after: int = 200

    # Internal Next.js render endpoint (TAILOR-4).
    # The backend POSTs the tailored-resume payload to the frontend's
    # `/api/internal/render-resume` Route Handler, which server-renders the
    # React `ClassicTemplate` and returns HTML. In Docker compose the
    # frontend service is reachable as `http://frontend:3000`; for bare-metal
    # local dev override `FRONTEND_INTERNAL_URL` to e.g. `http://localhost:3000`.
    frontend_internal_url: str = "http://frontend:3000"
    # Shared secret sent in the `X-Internal-Secret` header so the Route
    # Handler can reject any request that didn't come from this backend.
    # Empty default — we fail fast at the call site if this is unset rather
    # than booting with an obviously broken config.
    internal_render_secret: str = ""

    # Anti-abuse rate limit (MONETIZE-5). Applied uniformly to ALL plans on
    # successful AI generations (tailor + cover letter combined). Sliding
    # window, NOT fixed. Block flag with TTL prevents the natural sliding
    # decay from re-enabling abusers immediately.
    ai_rate_limit_per_hour: int = 25
    ai_rate_limit_block_duration_min: int = 60

    # Paddle
    paddle_api_key: str = ""
    paddle_price_monthly: str = ""       # kept for backwards compat
    paddle_price_annual: str = ""        # kept for backwards compat
    paddle_price_id_monthly: str = ""    # matches PADDLE_PRICE_ID_MONTHLY env var
    paddle_price_id_annual: str = ""     # matches PADDLE_PRICE_ID_ANNUAL env var
    paddle_webhook_secret: str = ""
    paddle_environment: str = "sandbox"


settings = Settings()
