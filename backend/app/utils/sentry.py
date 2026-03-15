"""Helpers to attach user context to Sentry events after authentication."""
import sentry_sdk


def set_sentry_user(user_id: str, email: str) -> None:
    """Attach user context to the current Sentry scope."""
    sentry_sdk.set_user({"id": user_id, "email": email})


def clear_sentry_user() -> None:
    """Clear user context (e.g., on logout)."""
    sentry_sdk.set_user(None)
