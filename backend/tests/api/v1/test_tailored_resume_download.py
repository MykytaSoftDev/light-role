"""Tests for POST /api/v1/tailored-resumes/{id}/download (TAILOR-3).

The success path requires a real Chromium binary. CI / dev machines without
Playwright's browser installed should still be able to run the 404 path —
that's the smoke we always run. The Chromium-dependent test is auto-skipped
when the binary is absent.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models.job import Job
from app.models.tailored_resume import TailoredResume
from app.models.user import User
from app.utils.security import create_access_token, hash_password


# ---------------------------------------------------------------------------
# Helpers (mirror test_tailor.py fixture style, kept self-contained so the
# files can move independently).
# ---------------------------------------------------------------------------


def _create_user(db) -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"pdf_test_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("TestPass123!"),
        first_name="PDF",
        last_name="Tester",
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _create_job(db, user: User) -> Job:
    job = Job(
        id=uuid.uuid4(),
        user_id=user.id,
        title="Senior Engineer",
        company="Acme",
        description_raw="x",
        requirements=[],
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def _create_tailored_resume(
    db,
    user: User,
    job: Job,
    *,
    name: str = "Senior Engineer — Acme",
) -> TailoredResume:
    row = TailoredResume(
        user_id=user.id,
        job_id=job.id,
        name=name,
        profile_snapshot={
            "personal_info": {
                "full_name": "Test User",
                "email": "test@example.com",
                "phone": "+1-555-0100",
            },
        },
        tailored_data={
            "personal_info": {
                "full_name": "Test User",
                "email": "test@example.com",
                "phone": "+1-555-0100",
            },
        },
        matched_keywords=[],
        applied_changes={},
        match_score=80,
        sections_order_snapshot=[],
        font_snapshot="Inter",
        template_snapshot="classic",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _auth_cookies(user_id: str) -> dict[str, str]:
    return {"access_token": create_access_token(user_id)}


def _chromium_available() -> bool:
    """Return True iff a Playwright Chromium executable is installed."""
    try:
        from playwright.sync_api import sync_playwright  # noqa: WPS433

        with sync_playwright() as p:
            # `executable_path` is a property on the chromium type — it
            # raises if no compatible browser is on disk. We don't actually
            # launch — that's the expensive step.
            path = p.chromium.executable_path
            import os as _os
            return bool(path) and _os.path.exists(path)
    except Exception:
        return False


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
    db.query(TailoredResume).filter(TailoredResume.user_id == user.id).delete()
    db.query(Job).filter(Job.user_id == user.id).delete()
    db.commit()
    db.delete(user)
    db.commit()


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestDownloadEndpoint:
    """POST /api/v1/tailored-resumes/{id}/download."""

    def test_download_not_found(self, client: TestClient, test_user: User):
        """Random UUID → 404 (no Chromium needed)."""
        bogus_id = uuid.uuid4()
        resp = client.post(
            f"/api/v1/tailored-resumes/{bogus_id}/download",
            cookies=_auth_cookies(str(test_user.id)),
        )
        assert resp.status_code == 404

    def test_download_not_owner(self, client: TestClient, test_user: User, db):
        """Resume owned by another user → 404 (no existence leak)."""
        other = _create_user(db)
        try:
            job = _create_job(db, other)
            row = _create_tailored_resume(db, other, job)
            resp = client.post(
                f"/api/v1/tailored-resumes/{row.id}/download",
                cookies=_auth_cookies(str(test_user.id)),
            )
            assert resp.status_code == 404
        finally:
            db.query(TailoredResume).filter(TailoredResume.user_id == other.id).delete()
            db.query(Job).filter(Job.user_id == other.id).delete()
            db.commit()
            db.delete(other)
            db.commit()

    def test_download_unauthenticated(self, client: TestClient):
        """Missing cookie → 401."""
        resp = client.post(f"/api/v1/tailored-resumes/{uuid.uuid4()}/download")
        assert resp.status_code == 401

    @pytest.mark.skipif(
        not _chromium_available(),
        reason="Playwright Chromium binary not available in this environment",
    )
    def test_download_success(self, client: TestClient, test_user: User, db):
        """Full happy path — only runs when Chromium is installed."""
        job = _create_job(db, test_user)
        row = _create_tailored_resume(db, test_user, job, name="Senior Engineer — Acme Inc.")

        resp = client.post(
            f"/api/v1/tailored-resumes/{row.id}/download",
            cookies=_auth_cookies(str(test_user.id)),
        )
        assert resp.status_code == 200, resp.text
        assert resp.headers["content-type"] == "application/pdf"
        # PDFs always start with the magic %PDF- header.
        assert resp.content[:5] == b"%PDF-"
        assert len(resp.content) > 1000  # sanity — not an empty stub
        cd = resp.headers.get("content-disposition", "")
        assert "attachment" in cd
        assert ".pdf" in cd
