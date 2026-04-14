"""Tests for POST /api/v1/support/contact."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.database import SessionLocal
from app.main import app
from app.models.user import User
from app.utils.security import create_access_token, hash_password


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_test_user(db) -> User:
    """Insert a verified user into the DB and return it."""
    user = User(
        id=uuid.uuid4(),
        email=f"support_test_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("TestPass123!"),
        first_name="Support",
        last_name="Tester",
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth_cookies(user_id: str) -> dict[str, str]:
    """Return a cookies dict with a valid access_token."""
    token = create_access_token(user_id)
    return {"access_token": token}


_VALID_PAYLOAD = {
    "subject": "Cannot access my account",
    "message": "I have been unable to log in for the past two days despite correct credentials.",
    "category": "account",
}

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def test_user(db):
    user = _create_test_user(db)
    yield user
    db.delete(user)
    db.commit()


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestSupportContactEndpoint:

    def test_contact_success(self, client: TestClient, test_user: User):
        """Valid payload → 200, resend.Emails.send called."""
        with (
            patch("app.routers.support.check_rate_limit", new=AsyncMock(return_value=(True, 1))),
            patch("app.services.support_service.resend") as mock_resend,
        ):
            mock_resend.Emails.send = MagicMock(return_value={"id": "fake-email-id"})

            resp = client.post(
                "/api/v1/support/contact",
                json=_VALID_PAYLOAD,
                cookies=_auth_cookies(str(test_user.id)),
            )

        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["success"] is True
        assert "sent" in body["message"].lower()
        mock_resend.Emails.send.assert_called_once()

    def test_contact_resend_called_with_correct_args(self, client: TestClient, test_user: User):
        """Verify from, to, reply_to, and subject in the resend call."""
        with (
            patch("app.routers.support.check_rate_limit", new=AsyncMock(return_value=(True, 1))),
            patch("app.services.support_service.resend") as mock_resend,
        ):
            mock_resend.Emails.send = MagicMock(return_value={"id": "fake-email-id"})

            resp = client.post(
                "/api/v1/support/contact",
                json={
                    "subject": "Billing question about my invoice",
                    "message": "I was charged twice for my subscription this month.",
                    "category": "billing",
                },
                cookies=_auth_cookies(str(test_user.id)),
            )

        assert resp.status_code == 200, resp.text
        mock_resend.Emails.send.assert_called_once()
        call_kwargs = mock_resend.Emails.send.call_args[0][0]

        # from must be settings.resend_from_email (or fallback)
        expected_from = settings.resend_from_email or "Light Role <noreply@send.lightrole.com>"
        assert call_kwargs["from"] == expected_from

        # to must be the support inbox
        assert settings.support_email in call_kwargs["to"]

        # reply_to must be the user's email
        assert test_user.email in call_kwargs["reply_to"]

        # subject must contain category
        assert "billing" in call_kwargs["subject"]
        assert "[Support]" in call_kwargs["subject"]

    def test_contact_no_auth(self, client: TestClient):
        """Missing cookie → 401."""
        resp = client.post(
            "/api/v1/support/contact",
            json=_VALID_PAYLOAD,
        )
        assert resp.status_code == 401

    def test_contact_invalid_category(self, client: TestClient, test_user: User):
        """Unknown category → 422."""
        with patch("app.routers.support.check_rate_limit", new=AsyncMock(return_value=(True, 1))):
            resp = client.post(
                "/api/v1/support/contact",
                json={
                    "subject": "Some subject here",
                    "message": "A long enough message for this test case.",
                    "category": "not_valid_category",
                },
                cookies=_auth_cookies(str(test_user.id)),
            )
        assert resp.status_code == 422

    def test_contact_rate_limited(self, client: TestClient, test_user: User):
        """Second request within 1 hour → 429 with Retry-After header."""
        mock_ttl = 3500

        with (
            patch("app.routers.support.check_rate_limit", new=AsyncMock(return_value=(False, 2))),
            patch(
                "app.routers.support.get_redis_client",
                new=AsyncMock(
                    return_value=AsyncMock(ttl=AsyncMock(return_value=mock_ttl))
                ),
            ),
        ):
            resp = client.post(
                "/api/v1/support/contact",
                json=_VALID_PAYLOAD,
                cookies=_auth_cookies(str(test_user.id)),
            )

        assert resp.status_code == 429
        assert "Retry-After" in resp.headers
        assert resp.headers["Retry-After"] == str(mock_ttl)

    def test_contact_resend_failure_returns_503(self, client: TestClient, test_user: User):
        """When resend raises → endpoint returns 503."""
        with (
            patch("app.routers.support.check_rate_limit", new=AsyncMock(return_value=(True, 1))),
            patch("app.services.support_service.resend") as mock_resend,
        ):
            mock_resend.Emails.send = MagicMock(side_effect=Exception("Resend API down"))

            resp = client.post(
                "/api/v1/support/contact",
                json=_VALID_PAYLOAD,
                cookies=_auth_cookies(str(test_user.id)),
            )

        assert resp.status_code == 503
        assert "Unable to send" in resp.json()["detail"]
