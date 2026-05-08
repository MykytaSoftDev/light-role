"""Tests for /api/v1/users/* endpoints.

Currently focused on PREFS-1: PATCH /api/v1/users/me/resume-preferences and
the surfacing of `resume_preferences` on GET /api/v1/users/me.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models.user import User, _resume_preferences_default
from app.utils.security import create_access_token, hash_password


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _create_user(db) -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"users_test_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("TestPass123!"),
        first_name="Pref",
        last_name="Tester",
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth_cookies(user_id: str) -> dict[str, str]:
    return {"access_token": create_access_token(user_id)}


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
    user = _create_user(db)
    yield user
    db.delete(user)
    db.commit()


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# PATCH /api/v1/users/me/resume-preferences (PREFS-1)
# ---------------------------------------------------------------------------


class TestUpdateResumePreferences:
    """PREFS-1: partial JSONB merge for users.resume_preferences."""

    def test_patch_font_only_merges_keeping_other_fields(
        self, client: TestClient, test_user: User, db
    ):
        """Sending {font: 'Roboto'} → 200, font updated, sections_order untouched."""
        defaults = _resume_preferences_default()

        resp = client.patch(
            "/api/v1/users/me/resume-preferences",
            json={"font": "Roboto"},
            cookies=_auth_cookies(str(test_user.id)),
        )

        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["font"] == "Roboto"
        assert body["sections_order"] == defaults["sections_order"]
        assert body["template"] == "classic"

        # DB is actually mutated (JSONB reassign was correctly tracked).
        db.expire_all()
        db.refresh(test_user)
        assert test_user.resume_preferences["font"] == "Roboto"

    def test_patch_invalid_font_returns_422(
        self, client: TestClient, test_user: User
    ):
        """Unknown font → 422 from Pydantic field_validator."""
        resp = client.patch(
            "/api/v1/users/me/resume-preferences",
            json={"font": "Comic Sans"},
            cookies=_auth_cookies(str(test_user.id)),
        )
        assert resp.status_code == 422, resp.text

    def test_patch_non_classic_template_returns_400(
        self, client: TestClient, test_user: User
    ):
        """`template != "classic"` is a locked-feature 400, not a 422."""
        resp = client.patch(
            "/api/v1/users/me/resume-preferences",
            json={"template": "modern"},
            cookies=_auth_cookies(str(test_user.id)),
        )
        assert resp.status_code == 400, resp.text

    def test_patch_empty_body_returns_400(
        self, client: TestClient, test_user: User
    ):
        """`{}` (no fields provided) → 400."""
        resp = client.patch(
            "/api/v1/users/me/resume-preferences",
            json={},
            cookies=_auth_cookies(str(test_user.id)),
        )
        assert resp.status_code == 400, resp.text

    def test_get_me_after_patch_reflects_new_preferences(
        self, client: TestClient, test_user: User
    ):
        """GET /me after a successful PATCH → resume_preferences.font reflects update."""
        # Apply the patch.
        patch_resp = client.patch(
            "/api/v1/users/me/resume-preferences",
            json={"font": "Roboto"},
            cookies=_auth_cookies(str(test_user.id)),
        )
        assert patch_resp.status_code == 200, patch_resp.text

        # Fetch /me and confirm the merged shape is exposed.
        me_resp = client.get(
            "/api/v1/users/me",
            cookies=_auth_cookies(str(test_user.id)),
        )
        assert me_resp.status_code == 200, me_resp.text
        body = me_resp.json()
        assert "resume_preferences" in body
        assert body["resume_preferences"]["font"] == "Roboto"
        assert body["resume_preferences"]["template"] == "classic"
        assert isinstance(body["resume_preferences"]["sections_order"], list)
        assert len(body["resume_preferences"]["sections_order"]) == 9
