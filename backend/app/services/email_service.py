import logging

import resend

from app.config import settings

logger = logging.getLogger(__name__)

_SENDER = settings.resend_from_email or "Light Role <noreply@send.lightrole.com>"
_VERIFY_EMAIL_TTL_HOURS = 24
_RESET_EMAIL_TTL_HOURS = 1


def _resend_enabled() -> bool:
    if not settings.resend_api_key:
        logger.warning("resend_api_key is not set — skipping email send (dev mode)")
        return False
    resend.api_key = settings.resend_api_key
    return True


def send_verification_email(email: str, token: str) -> None:
    """Send an email verification link to the user."""
    if not _resend_enabled():
        return

    verify_url = f"{settings.frontend_url}/auth/verify-email?token={token}"

    html = f"""
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px 20px; background-color: #f8fafc;">
        <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
            <h1 style="color: #0f172a; font-size: 24px; font-weight: 600; margin: 0 0 16px;">Verify your email</h1>
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Thanks for signing up for Light Role! Please verify your email address by clicking the button below.
            </p>
            <a href="{verify_url}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5, #4338ca); color: white; text-decoration: none; padding: 14px 28px; border-radius: 9999px; font-weight: 500; font-size: 16px;">
                Verify Email
            </a>
            <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 24px 0 0;">
                This link will expire in {_VERIFY_EMAIL_TTL_HOURS} hours. If you didn't create an account, you can safely ignore this email.
            </p>
        </div>
    </body>
    </html>
    """

    try:
        resend.Emails.send({
            "from": _SENDER,
            "to": [email],
            "subject": "Verify your email - Light Role",
            "html": html,
        })
        logger.info(f"Verification email sent to {email}")
    except Exception as exc:
        logger.error(f"Failed to send verification email to {email}: {exc}")
        raise


def send_welcome_email(email: str) -> None:
    """Send a welcome email after successful verification."""
    if not _resend_enabled():
        return

    dashboard_url = f"{settings.frontend_url}/dashboard"

    html = f"""
    <html>
      <body style="font-family: sans-serif; color: #1a1a1a; max-width: 600px; margin: auto; padding: 24px;">
        <h2>Welcome to Light Role!</h2>
        <p>Your email has been verified. You're all set to start managing your job search with AI.</p>
        <p>
          <a href="{dashboard_url}"
             style="display:inline-block; padding:12px 24px; background:#2563eb; color:#fff;
                    text-decoration:none; border-radius:6px; font-weight:600;">
            Go to Dashboard
          </a>
        </p>
        <p style="color:#6b7280; font-size:14px;">
          Good luck with your job search!<br>
          — The Light Role Team
        </p>
      </body>
    </html>
    """

    try:
        resend.Emails.send({
            "from": _SENDER,
            "to": [email],
            "subject": "Welcome to Light Role",
            "html": html,
        })
        logger.info(f"Welcome email sent to {email}")
    except Exception as exc:
        logger.error(f"Failed to send welcome email to {email}: {exc}")
        raise


def send_password_reset_email(email: str, token: str) -> None:
    """Send a password reset link to the user."""
    if not _resend_enabled():
        return

    reset_url = f"{settings.frontend_url}/auth/reset-password?token={token}"

    html = f"""
    <html>
      <body style="font-family: sans-serif; color: #1a1a1a; max-width: 600px; margin: auto; padding: 24px;">
        <h2>Reset your Light Role password</h2>
        <p>We received a request to reset the password for your account.</p>
        <p>
          <a href="{reset_url}"
             style="display:inline-block; padding:12px 24px; background:#2563eb; color:#fff;
                    text-decoration:none; border-radius:6px; font-weight:600;">
            Reset Password
          </a>
        </p>
        <p style="color:#6b7280; font-size:14px;">
          This link expires in {_RESET_EMAIL_TTL_HOURS} hour.<br>
          If you did not request a password reset, you can safely ignore this email.
        </p>
        <p style="color:#6b7280; font-size:14px;">Or copy and paste this URL into your browser:<br>
          <a href="{reset_url}" style="color:#2563eb;">{reset_url}</a>
        </p>
      </body>
    </html>
    """

    try:
        resend.Emails.send({
            "from": _SENDER,
            "to": [email],
            "subject": "Reset your Light Role password",
            "html": html,
        })
        logger.info(f"Password reset email sent to {email}")
    except Exception as exc:
        logger.error(f"Failed to send password reset email to {email}: {exc}")
        raise
