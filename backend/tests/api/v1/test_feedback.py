"""Tests for POST /api/v1/feedback."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models.feedback import Feedback
from app.models.user import User
from app.utils.security import create_access_token, hash_password


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_test_user(db) -> User:
    """Insert a verified user into the DB and return it."""
    user = User(
        id=uuid.uuid4(),
        email=f"test_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("TestPass123!"),
        first_name="Test",
        last_name="User",
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


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def db():
    """Provide a real DB session; roll back after each test."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def test_user(db):
    """Create a test user and clean it up after the test."""
    user = _create_test_user(db)
    yield user
    # Cleanup: delete the user (cascades to feedbacks)
    db.delete(user)
    db.commit()


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# Helper: patch check_rate_limit to always allow
# ---------------------------------------------------------------------------

def _allow_rate_limit(*args, **kwargs):
    """Async mock that always allows (returns (True, 1))."""
    async def _inner(*a, **kw):
        return True, 1
    return _inner()


def _block_rate_limit(*args, **kwargs):
    """Async mock that always blocks (returns (False, 2))."""
    async def _inner(*a, **kw):
        return False, 2
    return _inner()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestFeedbackEndpoint:

    def test_submit_feedback_success(self, client: TestClient, test_user: User, db):
        """Valid payload from verified user → 201 with feedback in DB."""
        with (
            patch("app.routers.feedback.check_rate_limit", new=AsyncMock(return_value=(True, 1))),
        ):
            resp = client.post(
                "/api/v1/feedback",
                json={
                    "type": "bug",
                    "message": "This is a bug report with enough detail.",
                    "page_url": "https://app.lightrole.com/dashboard",
                },
                cookies=_auth_cookies(str(test_user.id)),
            )

        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["type"] == "bug"
        assert body["status"] == "new"
        assert "id" in body

        # Verify the row exists in DB
        feedback_id = uuid.UUID(body["id"])
        db.expire_all()
        row = db.query(Feedback).filter(Feedback.id == feedback_id).first()
        assert row is not None
        assert row.user_id == test_user.id
        assert row.message == "This is a bug report with enough detail."
        # Cleanup
        db.delete(row)
        db.commit()

    def test_submit_feedback_no_auth(self, client: TestClient):
        """Missing cookie → 401."""
        resp = client.post(
            "/api/v1/feedback",
            json={
                "type": "general",
                "message": "A message with enough length here.",
            },
        )
        assert resp.status_code == 401

    def test_submit_feedback_invalid_type(self, client: TestClient, test_user: User):
        """Unknown feedback type → 422."""
        with patch("app.routers.feedback.check_rate_limit", new=AsyncMock(return_value=(True, 1))):
            resp = client.post(
                "/api/v1/feedback",
                json={
                    "type": "not_a_real_type",
                    "message": "This is a message with enough length.",
                },
                cookies=_auth_cookies(str(test_user.id)),
            )
        assert resp.status_code == 422

    def test_submit_feedback_message_too_short(self, client: TestClient, test_user: User):
        """Message shorter than 10 chars → 422."""
        with patch("app.routers.feedback.check_rate_limit", new=AsyncMock(return_value=(True, 1))):
            resp = client.post(
                "/api/v1/feedback",
                json={
                    "type": "general",
                    "message": "Short",
                },
                cookies=_auth_cookies(str(test_user.id)),
            )
        assert resp.status_code == 422

    def test_submit_feedback_rate_limited(self, client: TestClient, test_user: User):
        """Second submission within 1 hour → 429 with Retry-After header."""
        mock_ttl = 3540  # ~59 minutes remaining

        with (
            patch("app.routers.feedback.check_rate_limit", new=AsyncMock(return_value=(False, 2))),
            patch(
                "app.routers.feedback.get_redis_client",
                new=AsyncMock(
                    return_value=AsyncMock(ttl=AsyncMock(return_value=mock_ttl))
                ),
            ),
        ):
            resp = client.post(
                "/api/v1/feedback",
                json={
                    "type": "bug",
                    "message": "Another bug report message here.",
                },
                cookies=_auth_cookies(str(test_user.id)),
            )

        assert resp.status_code == 429
        assert "Retry-After" in resp.headers
        assert resp.headers["Retry-After"] == str(mock_ttl)
        assert "once per hour" in resp.json()["detail"]

    def test_submit_feedback_captures_user_agent(self, client: TestClient, test_user: User, db):
        """User-Agent header is captured and stored on the feedback row."""
        ua = "Mozilla/5.0 (Test Browser)"

        with patch("app.routers.feedback.check_rate_limit", new=AsyncMock(return_value=(True, 1))):
            resp = client.post(
                "/api/v1/feedback",
                json={
                    "type": "feature_request",
                    "message": "Please add a dark mode to the dashboard.",
                },
                cookies=_auth_cookies(str(test_user.id)),
                headers={"User-Agent": ua},
            )

        assert resp.status_code == 201, resp.text
        feedback_id = uuid.UUID(resp.json()["id"])

        db.expire_all()
        row = db.query(Feedback).filter(Feedback.id == feedback_id).first()
        assert row is not None
        assert row.user_agent == ua
        # Cleanup
        db.delete(row)
        db.commit()
