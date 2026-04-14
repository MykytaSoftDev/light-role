from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

import resend

from app.config import settings
from app.models.user import User
from app.schemas.support import SupportContactRequest

logger = logging.getLogger(__name__)


class SupportEmailError(Exception):
    """Raised when the support email fails to send."""


def _resend_enabled() -> bool:
    if not settings.resend_api_key:
        logger.warning("resend_api_key is not set — skipping support email send (dev mode)")
        return False
    resend.api_key = settings.resend_api_key
    return True


def _build_support_email_html(user: User, data: SupportContactRequest, timestamp: str) -> str:
    full_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or "N/A"
    return f"""
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px 20px; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
            <h2 style="color: #0f172a; font-size: 22px; font-weight: 600; margin: 0 0 24px;">New Support Request</h2>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 130px; vertical-align: top;">Name</td>
                    <td style="padding: 8px 0; color: #0f172a; font-size: 14px;">{full_name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px; vertical-align: top;">Email</td>
                    <td style="padding: 8px 0; color: #0f172a; font-size: 14px;">
                        <a href="mailto:{user.email}" style="color: #4f46e5;">{user.email}</a>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px; vertical-align: top;">User ID</td>
                    <td style="padding: 8px 0; color: #0f172a; font-size: 14px; font-family: monospace;">{user.id}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px; vertical-align: top;">Category</td>
                    <td style="padding: 8px 0; color: #0f172a; font-size: 14px;">{data.category.value}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px; vertical-align: top;">Subject</td>
                    <td style="padding: 8px 0; color: #0f172a; font-size: 14px;">{data.subject}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px; vertical-align: top;">Submitted At</td>
                    <td style="padding: 8px 0; color: #0f172a; font-size: 14px;">{timestamp}</td>
                </tr>
            </table>

            <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px;">Message</p>
                <p style="color: #0f172a; font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-wrap;">{data.message}</p>
            </div>

            <p style="color: #94a3b8; font-size: 13px; margin: 0; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                Reply to this email to respond directly to the user.
            </p>
        </div>
    </body>
    </html>
    """


def _build_support_email_text(user: User, data: SupportContactRequest, timestamp: str) -> str:
    full_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or "N/A"
    return (
        f"New Support Request\n"
        f"{'=' * 40}\n\n"
        f"Name:        {full_name}\n"
        f"Email:       {user.email}\n"
        f"User ID:     {user.id}\n"
        f"Category:    {data.category.value}\n"
        f"Subject:     {data.subject}\n"
        f"Submitted:   {timestamp}\n\n"
        f"Message:\n{'-' * 40}\n{data.message}\n\n"
        f"{'=' * 40}\n"
        f"Reply to this email to respond directly to the user."
    )


async def send_support_email(user: User, data: SupportContactRequest) -> None:
    """Send a support contact email to the support inbox."""
    if not _resend_enabled():
        logger.info(
            "Support email skipped (resend disabled)",
            extra={"user_id": str(user.id), "category": data.category.value},
        )
        return

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    sender = settings.resend_from_email or "Light Role <noreply@send.lightrole.com>"
    subject = f"[Support][{data.category.value}] {data.subject}"
    html_body = _build_support_email_html(user, data, timestamp)
    text_body = _build_support_email_text(user, data, timestamp)

    def _send() -> None:
        resend.Emails.send({
            "from": sender,
            "to": [settings.support_email],
            "reply_to": [user.email],
            "subject": subject,
            "html": html_body,
            "text": text_body,
        })

    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _send)
        logger.info(
            "Support email sent",
            extra={"user_id": str(user.id), "category": data.category.value},
        )
    except Exception as exc:
        logger.error(
            "Failed to send support email",
            extra={"user_id": str(user.id), "category": data.category.value},
            exc_info=True,
        )
        try:
            import sentry_sdk
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("category", data.category.value)
                scope.set_user({"id": str(user.id), "email": user.email})
                sentry_sdk.capture_exception(exc)
        except Exception:
            pass
        raise SupportEmailError(str(exc)) from exc
