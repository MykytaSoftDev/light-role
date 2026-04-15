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
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # CORS
    frontend_url: str = "https://dev.lightrole.com"
    cookie_secure: bool = False
    cookie_domain: str = ""

    # OpenAI
    openai_api_key: str = ""

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
    analytics_cache_version: int = 1

    # Paddle
    paddle_api_key: str = ""
    paddle_price_monthly: str = ""       # kept for backwards compat
    paddle_price_annual: str = ""        # kept for backwards compat
    paddle_price_id_monthly: str = ""    # matches PADDLE_PRICE_ID_MONTHLY env var
    paddle_price_id_annual: str = ""     # matches PADDLE_PRICE_ID_ANNUAL env var
    paddle_webhook_secret: str = ""
    paddle_environment: str = "sandbox"


settings = Settings()
