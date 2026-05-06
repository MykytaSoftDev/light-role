"""Tests for POST /api/v1/jobs/{job_id}/tailor (TAILOR-2)."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.ai.interface import AIUsageInfo, GenerateTailoredResumeResult
from app.database import SessionLocal
from app.main import app
from app.models.job import Job
from app.models.profile import UserProfile
from app.models.tailored_resume import TailoredResume
from app.models.usage_log import UsageLog
from app.models.user import User
from app.utils.security import create_access_token, hash_password


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_test_user(db) -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"tailor_test_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("TestPass123!"),
        first_name="Tailor",
        last_name="Tester",
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth_cookies(user_id: str) -> dict[str, str]:
    return {"access_token": create_access_token(user_id)}


def _create_job(
    db,
    user: User,
    title: str = "Senior Backend Engineer",
    company: str = "Acme Corp",
) -> Job:
    job = Job(
        id=uuid.uuid4(),
        user_id=user.id,
        title=title,
        company=company,
        description_raw="Build backend services in Python.",
        requirements=["Python", "FastAPI"],
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def _set_profile(
    db,
    user: User,
    *,
    with_employment: bool = True,
    with_projects: bool = False,
) -> UserProfile:
    """Insert (or replace) a profile row for the given user.

    Profile readiness flag mirrors PRD 3.4.A.2: at least 1 employment OR
    project entry. Either flag can be flipped on/off independently.
    """
    employment = (
        [
            {
                "id": str(uuid.uuid4()),
                "role": "Backend Engineer",
                "company": "Prev Co",
                "start_date": "2020-01",
                "is_current": True,
                "details": ["Built things."],
            }
        ]
        if with_employment
        else []
    )
    projects = (
        [
            {
                "id": str(uuid.uuid4()),
                "name": "Side project",
                "description": "Something cool.",
                "details": ["Used Python."],
                "technologies": ["Python"],
            }
        ]
        if with_projects
        else []
    )
    profile_data = {
        "personal_info": {
            "full_name": "Test User",
            "email": "test@example.com",
            "phone": "+1-555-0100",
        },
        "summary": "Senior engineer.",
        "employment": employment,
        "education": [],
        "skills": [{"id": str(uuid.uuid4()), "name": "Python"}],
        "projects": projects,
        "languages": [],
        "certificates": [],
        "achievements": [],
        "volunteer": [],
    }
    existing = (
        db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    )
    if existing:
        existing.profile_data = profile_data
        db.commit()
        db.refresh(existing)
        return existing
    profile = UserProfile(user_id=user.id, profile_data=profile_data)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def _make_ai_success_result(match_score: int = 78) -> GenerateTailoredResumeResult:
    return GenerateTailoredResumeResult(
        tailored_data={
            "personal_info": {
                "full_name": "Test User",
                "email": "test@example.com",
                "phone": "+1-555-0100",
            },
            "summary": "Senior engineer who matches the role.",
            "employment": [],
            "education": [],
            "skills": [{"name": "Python"}, {"name": "FastAPI"}],
            "projects": [],
            "languages": [],
            "certificates": [],
            "achievements": [],
            "volunteer": [],
        },
        matched_keywords=[
            {"term": "Python", "color_id": 1},
            {"term": "FastAPI", "color_id": 2},
        ],
        applied_changes={
            "summary": ["Rephrased opening to mention job-relevant skills."],
        },
        match_score=match_score,
        usage=AIUsageInfo(
            model="mock", tokens_input=500, tokens_output=400, response_time_ms=10
        ),
        success=True,
    )


def _make_ai_failure_result() -> GenerateTailoredResumeResult:
    return GenerateTailoredResumeResult(
        tailored_data={},
        matched_keywords=[],
        applied_changes={},
        match_score=0,
        usage=None,
        success=False,
    )


def _patch_ai(result: GenerateTailoredResumeResult):
    """Patch the module-level _ai_service.generate_tailored_resume."""
    return patch(
        "app.routers.jobs._ai_service.generate_tailored_resume",
        new=AsyncMock(return_value=result),
    )


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
    # Hard cleanup: cascading deletes remove profile / jobs / tailored_resumes /
    # usage_log / notifications.
    db.query(UsageLog).filter(UsageLog.user_id == user.id).delete()
    db.query(TailoredResume).filter(TailoredResume.user_id == user.id).delete()
    db.query(Job).filter(Job.user_id == user.id).delete()
    db.query(UserProfile).filter(UserProfile.user_id == user.id).delete()
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

class TestTailorEndpoint:
    """POST /api/v1/jobs/{job_id}/tailor (TAILOR-2)."""

    def test_tailor_success(self, client: TestClient, test_user: User, db):
        """Happy path → 201 with TailoredResumeResponse + DB row + usage_log."""
        _set_profile(db, test_user, with_employment=True)
        job = _create_job(db, test_user)

        ai_result = _make_ai_success_result(match_score=82)
        ai_mock = AsyncMock(return_value=ai_result)
        with patch(
            "app.routers.jobs._ai_service.generate_tailored_resume", new=ai_mock
        ):
            resp = client.post(
                f"/api/v1/jobs/{job.id}/tailor",
                cookies=_auth_cookies(str(test_user.id)),
            )

        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["job_id"] == str(job.id)
        assert body["user_id"] == str(test_user.id)
        assert body["match_score"] == 82
        assert body["name"].startswith("Senior Backend Engineer")
        assert body["template_snapshot"] == "classic"
        assert body["font_snapshot"] == "Inter"
        assert isinstance(body["sections_order_snapshot"], list)
        assert len(body["sections_order_snapshot"]) > 0
        assert body["matched_keywords"][0]["term"] == "Python"
        # snapshot fields are present
        assert "profile_snapshot" in body
        assert "tailored_data" in body
        # Joined-Job convenience fields the editor uses for its subtitle.
        assert body["job_title"] == "Senior Backend Engineer"
        assert body["job_company"] == "Acme Corp"

        # AI was called exactly once
        assert ai_mock.await_count == 1

        # DB row exists
        db.expire_all()
        row = (
            db.query(TailoredResume)
            .filter(TailoredResume.id == uuid.UUID(body["id"]))
            .first()
        )
        assert row is not None
        assert row.match_score == 82
        assert row.user_id == test_user.id
        assert row.job_id == job.id

        # usage_log row written with success=True
        log_rows = (
            db.query(UsageLog)
            .filter(
                UsageLog.user_id == test_user.id,
                UsageLog.operation_type == "tailor_resume",
            )
            .all()
        )
        assert len(log_rows) == 1
        assert log_rows[0].success is True
        assert log_rows[0].cost_type == "resume_credit"
        assert log_rows[0].entity_type == "tailored_resume"
        assert log_rows[0].entity_id == row.id

    def test_tailor_job_not_found(self, client: TestClient, test_user: User, db):
        """Non-existent job_id → 404."""
        _set_profile(db, test_user, with_employment=True)
        bogus_id = uuid.uuid4()
        with _patch_ai(_make_ai_success_result()):
            resp = client.post(
                f"/api/v1/jobs/{bogus_id}/tailor",
                cookies=_auth_cookies(str(test_user.id)),
            )
        assert resp.status_code == 404

    def test_tailor_job_not_owned(self, client: TestClient, test_user: User, db):
        """Job owned by another user → 404 (no existence leak)."""
        _set_profile(db, test_user, with_employment=True)

        # Create a second user + a job they own.
        other = _create_test_user(db)
        other_job = _create_job(db, other, title="Other Job", company="Other Co")
        try:
            with _patch_ai(_make_ai_success_result()):
                resp = client.post(
                    f"/api/v1/jobs/{other_job.id}/tailor",
                    cookies=_auth_cookies(str(test_user.id)),
                )
            assert resp.status_code == 404
        finally:
            db.query(Job).filter(Job.user_id == other.id).delete()
            db.commit()
            db.delete(other)
            db.commit()

    def test_tailor_existing_resume_conflicts(
        self, client: TestClient, test_user: User, db
    ):
        """Existing TailoredResume for (user, job) → 409 with RESUME_ALREADY_EXISTS."""
        _set_profile(db, test_user, with_employment=True)
        job = _create_job(db, test_user)

        # Pre-insert a TailoredResume for this (user, job).
        existing = TailoredResume(
            user_id=test_user.id,
            job_id=job.id,
            name="Existing",
            profile_snapshot={},
            tailored_data={},
            matched_keywords=[],
            applied_changes={},
            match_score=50,
            sections_order_snapshot=[],
            font_snapshot="Inter",
            template_snapshot="classic",
        )
        db.add(existing)
        db.commit()

        ai_mock = AsyncMock(return_value=_make_ai_success_result())
        with patch(
            "app.routers.jobs._ai_service.generate_tailored_resume", new=ai_mock
        ):
            resp = client.post(
                f"/api/v1/jobs/{job.id}/tailor",
                cookies=_auth_cookies(str(test_user.id)),
            )
        assert resp.status_code == 409
        body = resp.json()
        # FastAPI wraps `detail=` content under top-level "detail".
        detail = body["detail"]
        assert detail["error_code"] == "RESUME_ALREADY_EXISTS"
        # Frontend loading screen needs this id to redirect to the editor.
        assert detail["existing_resume_id"] == str(existing.id)
        # AI must NOT be called when a resume already exists.
        assert ai_mock.await_count == 0

    def test_tailor_profile_not_ready(
        self, client: TestClient, test_user: User, db
    ):
        """Empty employment AND projects → 400 PROFILE_NOT_READY."""
        _set_profile(db, test_user, with_employment=False, with_projects=False)
        job = _create_job(db, test_user)

        ai_mock = AsyncMock(return_value=_make_ai_success_result())
        with patch(
            "app.routers.jobs._ai_service.generate_tailored_resume", new=ai_mock
        ):
            resp = client.post(
                f"/api/v1/jobs/{job.id}/tailor",
                cookies=_auth_cookies(str(test_user.id)),
            )
        assert resp.status_code == 400
        body = resp.json()
        detail = body["detail"]
        assert detail["error_code"] == "PROFILE_NOT_READY"
        # AI must NOT be called when profile is not ready.
        assert ai_mock.await_count == 0

    def test_tailor_profile_ready_via_projects_only(
        self, client: TestClient, test_user: User, db
    ):
        """No employment but ≥1 project entry → still ready (PRD 3.4.A.2)."""
        _set_profile(
            db, test_user, with_employment=False, with_projects=True
        )
        job = _create_job(db, test_user)
        with _patch_ai(_make_ai_success_result()):
            resp = client.post(
                f"/api/v1/jobs/{job.id}/tailor",
                cookies=_auth_cookies(str(test_user.id)),
            )
        assert resp.status_code == 201, resp.text

    def test_tailor_ai_failure_returns_502(
        self, client: TestClient, test_user: User, db
    ):
        """AI returns success=False → 502, no DB row, failure logged."""
        _set_profile(db, test_user, with_employment=True)
        job = _create_job(db, test_user)

        with _patch_ai(_make_ai_failure_result()):
            resp = client.post(
                f"/api/v1/jobs/{job.id}/tailor",
                cookies=_auth_cookies(str(test_user.id)),
            )
        assert resp.status_code == 502

        # No tailored_resumes row was written.
        db.expire_all()
        row = (
            db.query(TailoredResume)
            .filter(
                TailoredResume.user_id == test_user.id,
                TailoredResume.job_id == job.id,
            )
            .first()
        )
        assert row is None

        # usage_log records the failure (success=False).
        log_rows = (
            db.query(UsageLog)
            .filter(
                UsageLog.user_id == test_user.id,
                UsageLog.operation_type == "tailor_resume",
            )
            .all()
        )
        assert len(log_rows) == 1
        assert log_rows[0].success is False
        assert log_rows[0].cost_type == "resume_credit"

    def test_tailor_unauthenticated(self, client: TestClient, test_user: User, db):
        """Missing cookie → 401."""
        job = _create_job(db, test_user)
        resp = client.post(f"/api/v1/jobs/{job.id}/tailor")
        assert resp.status_code == 401
