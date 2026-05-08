"""Tests for cover-letter generation (CL-2) and finalization (CL-3).

CL-2: POST /api/v1/jobs/{job_id}/cover-letter
CL-3: POST /api/v1/cover-letters

Auth model and ownership semantics mirror the tailor endpoint
(see test_tailor.py): both "not found" and "owned by another user"
return 404 to avoid existence leaks.
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.ai.interface import (
    AIUsageInfo,
    CoverLetterVariant as AICoverLetterVariant,
    GenerateCoverLetterResult,
)
from app.database import SessionLocal
from app.main import app
from app.models.cover_letter import CoverLetter
from app.models.enums import CLLength, CLStyle, CLTone, NotificationType
from app.models.job import Job
from app.models.notification import Notification
from app.models.profile import UserProfile
from app.models.tailored_resume import TailoredResume
from app.models.usage_log import UsageLog
from app.models.user import User
from app.utils.security import create_access_token, hash_password


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _create_user(db) -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"cl_test_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("TestPass123!"),
        first_name="CL",
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


def _create_tailored_resume(db, user: User, job: Job) -> TailoredResume:
    row = TailoredResume(
        user_id=user.id,
        job_id=job.id,
        name=f"TR for {job.title}",
        profile_snapshot={"employment": []},
        tailored_data={
            "personal_info": {"full_name": "Test User"},
            "summary": "Tailored summary.",
            "employment": [],
            "education": [],
            "skills": [{"name": "Python"}],
            "projects": [],
            "languages": [],
            "certificates": [],
            "achievements": [],
            "volunteer": [],
        },
        matched_keywords=[{"term": "Python", "color_id": 1}],
        applied_changes={"summary": ["Mock change."]},
        match_score=80,
        sections_order_snapshot=["summary", "skills", "employment"],
        font_snapshot="Inter",
        template_snapshot="classic",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _make_ai_success_result() -> GenerateCoverLetterResult:
    return GenerateCoverLetterResult(
        variants=[
            AICoverLetterVariant(content=f"variant {i+1} body text\nsecond line")
            for i in range(3)
        ],
        usage=AIUsageInfo(
            model="mock", tokens_input=150, tokens_output=300, response_time_ms=10
        ),
        success=True,
    )


def _make_ai_failure_result() -> GenerateCoverLetterResult:
    return GenerateCoverLetterResult(
        variants=[],
        usage=None,
        success=False,
    )


def _patch_ai(result: GenerateCoverLetterResult):
    return patch(
        "app.routers.jobs._ai_service.generate_cover_letter",
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
    user = _create_user(db)
    yield user
    # Hard cleanup: cascading deletes remove profile/jobs/CL/TR/usage_log.
    db.query(Notification).filter(Notification.user_id == user.id).delete()
    db.query(UsageLog).filter(UsageLog.user_id == user.id).delete()
    db.query(CoverLetter).filter(CoverLetter.user_id == user.id).delete()
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


# ===========================================================================
# CL-2: POST /api/v1/jobs/{job_id}/cover-letter
# ===========================================================================


class TestCoverLetterGenerateEndpoint:
    """POST /api/v1/jobs/{job_id}/cover-letter (CL-2)."""

    def test_generate_success_tailored_resume_source(
        self, client: TestClient, test_user: User, db
    ):
        """Happy path with source_type=tailored_resume → 200, 3 variants,
        usage_log row written.
        """
        _set_profile(db, test_user, with_employment=True)
        job = _create_job(db, test_user)
        _create_tailored_resume(db, test_user, job)

        ai_mock = AsyncMock(return_value=_make_ai_success_result())
        with patch(
            "app.routers.jobs._ai_service.generate_cover_letter", new=ai_mock
        ):
            resp = client.post(
                f"/api/v1/jobs/{job.id}/cover-letter",
                cookies=_auth_cookies(str(test_user.id)),
                json={
                    "source_type": "tailored_resume",
                    "style": "job_matched",
                    "tone": "confident",
                    "length": "medium",
                    "additional_context": "I'm relocating to Berlin.",
                },
            )

        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert "variants" in body
        assert len(body["variants"]) == 3
        assert all("content" in v for v in body["variants"])
        assert body["variants"][0]["content"].startswith("variant 1")

        # AI was called exactly once with expected source_type
        assert ai_mock.await_count == 1
        called_preferences = ai_mock.await_args.args[2]
        assert called_preferences["source_type"] == "tailored_resume"
        assert called_preferences["additional_context"] == "I'm relocating to Berlin."

        # No CoverLetter row was persisted (CL-3 does that).
        db.expire_all()
        cl_rows = (
            db.query(CoverLetter)
            .filter(
                CoverLetter.user_id == test_user.id,
                CoverLetter.job_id == job.id,
            )
            .all()
        )
        assert cl_rows == []

        # usage_log row written with cost_type=cl_credit, success=True.
        log_rows = (
            db.query(UsageLog)
            .filter(
                UsageLog.user_id == test_user.id,
                UsageLog.operation_type == "generate_cover_letter",
            )
            .all()
        )
        assert len(log_rows) == 1
        assert log_rows[0].success is True
        assert log_rows[0].cost_type == "cl_credit"
        assert log_rows[0].entity_type == "job"
        assert log_rows[0].entity_id == job.id

    def test_generate_success_profile_source(
        self, client: TestClient, test_user: User, db
    ):
        """Happy path with source_type=profile (no TR exists) → 200."""
        _set_profile(db, test_user, with_employment=True)
        job = _create_job(db, test_user)

        with _patch_ai(_make_ai_success_result()):
            resp = client.post(
                f"/api/v1/jobs/{job.id}/cover-letter",
                cookies=_auth_cookies(str(test_user.id)),
                json={
                    "source_type": "profile",
                    "style": "professional",
                    "tone": "humble",
                    "length": "short",
                },
            )

        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert len(body["variants"]) == 3

    def test_generate_existing_cl_conflicts(
        self, client: TestClient, test_user: User, db
    ):
        """Existing CoverLetter for (user, job) → 409 with existing_id."""
        _set_profile(db, test_user, with_employment=True)
        job = _create_job(db, test_user)

        # Pre-insert a cover letter for this job.
        existing = CoverLetter(
            user_id=test_user.id,
            job_id=job.id,
            name="Existing CL",
            content={
                "type": "doc",
                "content": [{"type": "paragraph"}],
            },
            source_type="profile",
            source_snapshot={},
            style=CLStyle.JOB_MATCHED,
            tone=CLTone.CONFIDENT,
            length_setting=CLLength.MEDIUM,
        )
        db.add(existing)
        db.commit()
        db.refresh(existing)

        ai_mock = AsyncMock(return_value=_make_ai_success_result())
        with patch(
            "app.routers.jobs._ai_service.generate_cover_letter", new=ai_mock
        ):
            resp = client.post(
                f"/api/v1/jobs/{job.id}/cover-letter",
                cookies=_auth_cookies(str(test_user.id)),
                json={
                    "source_type": "profile",
                    "style": "job_matched",
                    "tone": "confident",
                    "length": "medium",
                },
            )

        assert resp.status_code == 409, resp.text
        body = resp.json()
        detail = body["detail"]
        assert detail["error_code"] == "COVER_LETTER_ALREADY_EXISTS"
        assert detail["existing_id"] == str(existing.id)
        # AI must NOT be called when a CL already exists.
        assert ai_mock.await_count == 0

    def test_generate_tailored_source_without_tr_returns_400(
        self, client: TestClient, test_user: User, db
    ):
        """source_type=tailored_resume but no TR for job → 400 TAILORED_RESUME_NOT_FOUND."""
        _set_profile(db, test_user, with_employment=True)
        job = _create_job(db, test_user)

        ai_mock = AsyncMock(return_value=_make_ai_success_result())
        with patch(
            "app.routers.jobs._ai_service.generate_cover_letter", new=ai_mock
        ):
            resp = client.post(
                f"/api/v1/jobs/{job.id}/cover-letter",
                cookies=_auth_cookies(str(test_user.id)),
                json={
                    "source_type": "tailored_resume",
                    "style": "job_matched",
                    "tone": "confident",
                    "length": "medium",
                },
            )

        assert resp.status_code == 400, resp.text
        detail = resp.json()["detail"]
        assert detail["error_code"] == "TAILORED_RESUME_NOT_FOUND"
        assert ai_mock.await_count == 0

    def test_generate_ai_failure_returns_502(
        self, client: TestClient, test_user: User, db
    ):
        """AI returns success=False → 502, no usage_log row, no credit consumed."""
        _set_profile(db, test_user, with_employment=True)
        job = _create_job(db, test_user)

        with _patch_ai(_make_ai_failure_result()):
            resp = client.post(
                f"/api/v1/jobs/{job.id}/cover-letter",
                cookies=_auth_cookies(str(test_user.id)),
                json={
                    "source_type": "profile",
                    "style": "job_matched",
                    "tone": "confident",
                    "length": "medium",
                },
            )

        assert resp.status_code == 502, resp.text
        detail = resp.json()["detail"]
        assert detail["error_code"] == "AI_GENERATION_FAILED"

        # No usage_log row written on AI failure (no credit consumed).
        db.expire_all()
        log_rows = (
            db.query(UsageLog)
            .filter(
                UsageLog.user_id == test_user.id,
                UsageLog.operation_type == "generate_cover_letter",
            )
            .all()
        )
        assert log_rows == []

    def test_generate_job_not_found(
        self, client: TestClient, test_user: User, db
    ):
        """Bogus job_id → 404."""
        _set_profile(db, test_user, with_employment=True)
        bogus_id = uuid.uuid4()
        with _patch_ai(_make_ai_success_result()):
            resp = client.post(
                f"/api/v1/jobs/{bogus_id}/cover-letter",
                cookies=_auth_cookies(str(test_user.id)),
                json={
                    "source_type": "profile",
                    "style": "job_matched",
                    "tone": "confident",
                    "length": "medium",
                },
            )
        assert resp.status_code == 404

    def test_generate_profile_not_ready(
        self, client: TestClient, test_user: User, db
    ):
        """Empty employment + projects → 400 PROFILE_NOT_READY."""
        _set_profile(db, test_user, with_employment=False, with_projects=False)
        job = _create_job(db, test_user)

        ai_mock = AsyncMock(return_value=_make_ai_success_result())
        with patch(
            "app.routers.jobs._ai_service.generate_cover_letter", new=ai_mock
        ):
            resp = client.post(
                f"/api/v1/jobs/{job.id}/cover-letter",
                cookies=_auth_cookies(str(test_user.id)),
                json={
                    "source_type": "profile",
                    "style": "job_matched",
                    "tone": "confident",
                    "length": "medium",
                },
            )
        assert resp.status_code == 400
        detail = resp.json()["detail"]
        assert detail["error_code"] == "PROFILE_NOT_READY"
        assert ai_mock.await_count == 0

    def test_generate_unauthenticated(
        self, client: TestClient, test_user: User, db
    ):
        """Missing cookie → 401."""
        job = _create_job(db, test_user)
        resp = client.post(
            f"/api/v1/jobs/{job.id}/cover-letter",
            json={
                "source_type": "profile",
                "style": "job_matched",
                "tone": "confident",
                "length": "medium",
            },
        )
        assert resp.status_code == 401


# ===========================================================================
# CL-12: disconnect-notification on backgrounded CL generation
# ===========================================================================
# When the user closes the tab during the AI call, the AI work continues
# server-side and the credit is still consumed. CL-12 says: drop a
# Notification so the user can navigate back to the wizard from the bell.
# Per CL-2 implementation_notes (option B) the variants are NOT persisted,
# so the notification carries entity_type='cover_letter' and entity_id=NULL.
# The frontend bell then routes to /dashboard/cover-letters/generate.


class TestCoverLetterDisconnectNotification:
    """CL-12: disconnect detection during CL generation."""

    def test_no_disconnect_creates_no_notification(
        self, client: TestClient, test_user: User, db
    ):
        """Happy path WITHOUT disconnect → success, no notification row.

        Sanity check that the disconnect path is not accidentally fired on
        every successful generation.
        """
        _set_profile(db, test_user, with_employment=True)
        job = _create_job(db, test_user)

        with _patch_ai(_make_ai_success_result()):
            resp = client.post(
                f"/api/v1/jobs/{job.id}/cover-letter",
                cookies=_auth_cookies(str(test_user.id)),
                json={
                    "source_type": "profile",
                    "style": "job_matched",
                    "tone": "confident",
                    "length": "medium",
                },
            )

        assert resp.status_code == 200, resp.text

        # No CL notification row was created.
        db.expire_all()
        notif_rows = (
            db.query(Notification)
            .filter(
                Notification.user_id == test_user.id,
                Notification.entity_type == "cover_letter",
            )
            .all()
        )
        assert notif_rows == []

    def test_disconnect_creates_notification(
        self, client: TestClient, test_user: User, db
    ):
        """Client disconnects post-AI → notification row inserted.

        Mocks `Request.is_disconnected` at the Starlette class level so the
        ASGI plumbing returns True regardless of the in-flight test request.
        """
        _set_profile(db, test_user, with_employment=True)
        job = _create_job(db, test_user, title="Backend Engineer", company="Acme")

        # Patch is_disconnected on the Starlette class — that's what FastAPI
        # injects for `request: Request`. Patch *during* the request lifecycle
        # so our pre-send checks are unaffected by the mock.
        async def _disconnected(self):  # noqa: ANN001 - method
            return True

        with _patch_ai(_make_ai_success_result()), patch(
            "starlette.requests.Request.is_disconnected", new=_disconnected
        ):
            resp = client.post(
                f"/api/v1/jobs/{job.id}/cover-letter",
                cookies=_auth_cookies(str(test_user.id)),
                json={
                    "source_type": "profile",
                    "style": "job_matched",
                    "tone": "confident",
                    "length": "medium",
                },
            )

        # The endpoint still returns 200 with variants — the disconnect
        # detection is purely additive.
        assert resp.status_code == 200, resp.text

        # Credit was consumed (usage_log row written) regardless of disconnect.
        db.expire_all()
        log_rows = (
            db.query(UsageLog)
            .filter(
                UsageLog.user_id == test_user.id,
                UsageLog.operation_type == "generate_cover_letter",
            )
            .all()
        )
        assert len(log_rows) == 1
        assert log_rows[0].success is True

        # Notification row inserted with the CL-12 shape.
        notif_rows = (
            db.query(Notification)
            .filter(
                Notification.user_id == test_user.id,
                Notification.entity_type == "cover_letter",
            )
            .all()
        )
        assert len(notif_rows) == 1
        notif = notif_rows[0]
        assert notif.type == NotificationType.COVER_LETTER_READY
        assert notif.entity_id is None
        assert notif.title == "Cover letter is ready"
        # Spec copy: must mention "ready" and direct user to "review variants".
        assert "ready" in notif.message.lower()
        assert "review variants" in notif.message.lower()
        # Job title interpolated into the message body.
        assert "Backend Engineer" in notif.message
        assert notif.is_read is False

    def test_disconnect_with_ai_failure_creates_no_notification(
        self, client: TestClient, test_user: User, db
    ):
        """AI failure path: even with disconnect, no notification (or usage_log).

        On AI failure we 502 before the disconnect check ever runs, so no
        credit is consumed and no notification is queued — the user will
        retry the wizard.
        """
        _set_profile(db, test_user, with_employment=True)
        job = _create_job(db, test_user)

        async def _disconnected(self):  # noqa: ANN001 - method
            return True

        with _patch_ai(_make_ai_failure_result()), patch(
            "starlette.requests.Request.is_disconnected", new=_disconnected
        ):
            resp = client.post(
                f"/api/v1/jobs/{job.id}/cover-letter",
                cookies=_auth_cookies(str(test_user.id)),
                json={
                    "source_type": "profile",
                    "style": "job_matched",
                    "tone": "confident",
                    "length": "medium",
                },
            )

        assert resp.status_code == 502, resp.text

        db.expire_all()
        # No usage_log row (no credit).
        log_rows = (
            db.query(UsageLog)
            .filter(
                UsageLog.user_id == test_user.id,
                UsageLog.operation_type == "generate_cover_letter",
            )
            .all()
        )
        assert log_rows == []
        # No notification row.
        notif_rows = (
            db.query(Notification)
            .filter(
                Notification.user_id == test_user.id,
                Notification.entity_type == "cover_letter",
            )
            .all()
        )
        assert notif_rows == []


# ===========================================================================
# CL-3: POST /api/v1/cover-letters
# ===========================================================================


class TestCoverLetterFinalizeEndpoint:
    """POST /api/v1/cover-letters (CL-3)."""

    def test_finalize_with_string_content_wraps_to_tiptap(
        self, client: TestClient, test_user: User, db
    ):
        """Plain-text content is wrapped server-side into Tiptap JSON."""
        job = _create_job(db, test_user)

        resp = client.post(
            "/api/v1/cover-letters",
            cookies=_auth_cookies(str(test_user.id)),
            json={
                "job_id": str(job.id),
                "name": "My CL",
                "content": "Dear Hiring Manager,\n\nThanks.",
                "source_type": "profile",
                "source_snapshot": {"employment": []},
                "style": "job_matched",
                "tone": "confident",
                "length": "medium",
            },
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["name"] == "My CL"
        assert body["job_id"] == str(job.id)
        assert body["source_type"] == "profile"
        assert body["style"] == "job_matched"
        assert body["tone"] == "confident"
        assert body["length"] == "medium"
        # content was wrapped into Tiptap.
        assert body["content"]["type"] == "doc"
        assert isinstance(body["content"]["content"], list)
        assert len(body["content"]["content"]) >= 1
        first_para = body["content"]["content"][0]
        assert first_para["type"] == "paragraph"
        # Original first line preserved as a text node.
        assert first_para["content"][0]["text"] == "Dear Hiring Manager,"

        # Row exists in DB
        db.expire_all()
        row = db.query(CoverLetter).filter(CoverLetter.id == uuid.UUID(body["id"])).first()
        assert row is not None
        assert row.user_id == test_user.id

    def test_finalize_with_dict_content_passes_through(
        self, client: TestClient, test_user: User, db
    ):
        """Tiptap JSON dict content is stored as-is (no wrapping)."""
        job = _create_job(db, test_user)

        tiptap = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": "Hello there."}],
                }
            ],
        }
        resp = client.post(
            "/api/v1/cover-letters",
            cookies=_auth_cookies(str(test_user.id)),
            json={
                "job_id": str(job.id),
                "name": "Dict CL",
                "content": tiptap,
                "source_type": "tailored_resume",
                "source_snapshot": {"summary": "..."},
                "style": "formal",
                "tone": "humble",
                "length": "long",
                "additional_context": "Note about timing.",
            },
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["content"] == tiptap
        assert body["source_type"] == "tailored_resume"
        assert body["style"] == "formal"
        assert body["tone"] == "humble"
        assert body["length"] == "long"
        assert body["additional_context"] == "Note about timing."

    def test_finalize_existing_cl_conflicts(
        self, client: TestClient, test_user: User, db
    ):
        """Existing CL for (user, job) → 409 with existing_id."""
        job = _create_job(db, test_user)
        existing = CoverLetter(
            user_id=test_user.id,
            job_id=job.id,
            name="Existing CL",
            content={"type": "doc", "content": [{"type": "paragraph"}]},
            source_type="profile",
            source_snapshot={},
            style=CLStyle.JOB_MATCHED,
            tone=CLTone.CONFIDENT,
            length_setting=CLLength.MEDIUM,
        )
        db.add(existing)
        db.commit()
        db.refresh(existing)

        resp = client.post(
            "/api/v1/cover-letters",
            cookies=_auth_cookies(str(test_user.id)),
            json={
                "job_id": str(job.id),
                "name": "New CL",
                "content": "body",
                "source_type": "profile",
                "source_snapshot": {},
                "style": "job_matched",
                "tone": "confident",
                "length": "medium",
            },
        )
        assert resp.status_code == 409, resp.text
        detail = resp.json()["detail"]
        assert detail["error_code"] == "COVER_LETTER_ALREADY_EXISTS"
        assert detail["existing_id"] == str(existing.id)

    def test_finalize_job_not_owned(
        self, client: TestClient, test_user: User, db
    ):
        """Job owned by another user → 404 (no existence leak)."""
        other = _create_user(db)
        other_job = _create_job(db, other, title="Other", company="Other Co")
        try:
            resp = client.post(
                "/api/v1/cover-letters",
                cookies=_auth_cookies(str(test_user.id)),
                json={
                    "job_id": str(other_job.id),
                    "name": "X",
                    "content": "body",
                    "source_type": "profile",
                    "source_snapshot": {},
                    "style": "job_matched",
                    "tone": "confident",
                    "length": "medium",
                },
            )
            assert resp.status_code == 404
        finally:
            db.query(Job).filter(Job.user_id == other.id).delete()
            db.commit()
            db.delete(other)
            db.commit()


# ===========================================================================
# CL-9: PDF + DOCX downloads
# ===========================================================================
# Both endpoints are FREE — no AI credit, no usage_log row. The PDF route
# delegates to `pdf_service.render_pdf` (Playwright/Chromium); we mock that
# in the success test so the suite doesn't require a browser binary.


def _persist_cover_letter(
    db,
    user: User,
    job: Job,
    *,
    name: str = "My Cover Letter",
    content: dict | None = None,
) -> CoverLetter:
    """Insert a CoverLetter row with sensible defaults for download tests."""
    if content is None:
        content = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "Dear Hiring Manager,"},
                    ],
                },
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "I am excited to apply."},
                    ],
                },
            ],
        }
    row = CoverLetter(
        user_id=user.id,
        job_id=job.id,
        name=name,
        content=content,
        source_type="profile",
        source_snapshot={},
        style=CLStyle.JOB_MATCHED,
        tone=CLTone.CONFIDENT,
        length_setting=CLLength.MEDIUM,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


class TestCoverLetterDownloadPDF:
    """POST /api/v1/cover-letters/{id}/download (CL-9 PDF)."""

    def test_download_pdf_success(self, client: TestClient, test_user: User, db):
        """Owner + valid id → 200, application/pdf, %PDF magic, attachment header.

        We mock `pdf_service.render_pdf` so the test runs without Chromium —
        the contract under test is auth + ownership + headers + the byte
        stream coming from whatever the renderer returns.
        """
        job = _create_job(db, test_user)
        cl = _persist_cover_letter(db, test_user, job, name="My Letter")

        # Pre-count usage_log rows to verify the endpoint is FREE.
        usage_before = (
            db.query(UsageLog).filter(UsageLog.user_id == test_user.id).count()
        )

        fake_pdf = b"%PDF-1.4\n%fake-pdf-bytes-for-test\n%%EOF"
        with patch(
            "app.routers.cover_letters.pdf_service.render_pdf",
            new=AsyncMock(return_value=fake_pdf),
        ):
            resp = client.post(
                f"/api/v1/cover-letters/{cl.id}/download",
                cookies=_auth_cookies(str(test_user.id)),
            )

        assert resp.status_code == 200, resp.text
        assert resp.headers["content-type"] == "application/pdf"
        cd = resp.headers.get("content-disposition", "")
        assert "attachment" in cd
        assert ".pdf" in cd
        # Sanitised filename: "My Letter" → "my-letter"
        assert "my-letter.pdf" in cd
        assert resp.content.startswith(b"%PDF")

        # No usage_log row written — endpoint is free.
        db.expire_all()
        usage_after = (
            db.query(UsageLog).filter(UsageLog.user_id == test_user.id).count()
        )
        assert usage_after == usage_before

    def test_download_pdf_not_owner_returns_404(
        self, client: TestClient, test_user: User, db
    ):
        """Cover letter owned by another user → 404 (no existence leak)."""
        other = _create_user(db)
        try:
            other_job = _create_job(db, other, title="Other", company="Other Co")
            cl = _persist_cover_letter(db, other, other_job, name="Theirs")

            resp = client.post(
                f"/api/v1/cover-letters/{cl.id}/download",
                cookies=_auth_cookies(str(test_user.id)),
            )
            assert resp.status_code == 404
        finally:
            db.query(CoverLetter).filter(CoverLetter.user_id == other.id).delete()
            db.query(Job).filter(Job.user_id == other.id).delete()
            db.commit()
            db.delete(other)
            db.commit()

    def test_download_pdf_not_found_returns_404(
        self, client: TestClient, test_user: User, db
    ):
        """Random UUID → 404."""
        bogus_id = uuid.uuid4()
        resp = client.post(
            f"/api/v1/cover-letters/{bogus_id}/download",
            cookies=_auth_cookies(str(test_user.id)),
        )
        assert resp.status_code == 404


class TestCoverLetterDownloadDOCX:
    """POST /api/v1/cover-letters/{id}/download-docx (CL-9 DOCX)."""

    def test_download_docx_success(self, client: TestClient, test_user: User, db):
        """Owner + valid id → 200, DOCX MIME, PK\\x03\\x04 magic, attachment."""
        job = _create_job(db, test_user)
        cl = _persist_cover_letter(db, test_user, job, name="Plain Letter")

        usage_before = (
            db.query(UsageLog).filter(UsageLog.user_id == test_user.id).count()
        )

        resp = client.post(
            f"/api/v1/cover-letters/{cl.id}/download-docx",
            cookies=_auth_cookies(str(test_user.id)),
        )
        assert resp.status_code == 200, resp.text
        # python-docx uses the ZIP-based OOXML container — magic = "PK\x03\x04".
        assert resp.content[:4] == b"PK\x03\x04"
        assert resp.headers["content-type"] == (
            "application/vnd.openxmlformats-officedocument."
            "wordprocessingml.document"
        )
        cd = resp.headers.get("content-disposition", "")
        assert "attachment" in cd
        assert "plain-letter.docx" in cd

        db.expire_all()
        usage_after = (
            db.query(UsageLog).filter(UsageLog.user_id == test_user.id).count()
        )
        assert usage_after == usage_before

    def test_download_docx_preserves_bold_and_italic(
        self, client: TestClient, test_user: User, db
    ):
        """Bold/italic marks in Tiptap → bold/italic runs in the DOCX output."""
        # Local import — only this test needs python-docx as a *consumer*.
        from io import BytesIO as _BytesIO

        from docx import Document as _Document

        job = _create_job(db, test_user)
        rich_content = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "Plain "},
                        {
                            "type": "text",
                            "text": "BoldPart",
                            "marks": [{"type": "bold"}],
                        },
                        {"type": "text", "text": " "},
                        {
                            "type": "text",
                            "text": "ItalicPart",
                            "marks": [{"type": "italic"}],
                        },
                    ],
                },
            ],
        }
        cl = _persist_cover_letter(
            db, test_user, job, name="Rich Letter", content=rich_content
        )

        resp = client.post(
            f"/api/v1/cover-letters/{cl.id}/download-docx",
            cookies=_auth_cookies(str(test_user.id)),
        )
        assert resp.status_code == 200, resp.text

        # Parse the DOCX and assert run-level formatting.
        doc = _Document(_BytesIO(resp.content))
        # First paragraph carries the marks; index by text for resilience.
        runs_by_text = {run.text: run for run in doc.paragraphs[0].runs}

        assert "Plain " in runs_by_text
        assert runs_by_text["Plain "].bold is not True
        assert runs_by_text["Plain "].italic is not True

        assert "BoldPart" in runs_by_text
        assert runs_by_text["BoldPart"].bold is True
        # Italic should be falsy on the bold run (None or False both fine).
        assert not runs_by_text["BoldPart"].italic

        assert "ItalicPart" in runs_by_text
        assert runs_by_text["ItalicPart"].italic is True
        assert not runs_by_text["ItalicPart"].bold

    def test_download_docx_not_owner_returns_404(
        self, client: TestClient, test_user: User, db
    ):
        """Cover letter owned by another user → 404."""
        other = _create_user(db)
        try:
            other_job = _create_job(db, other, title="Other", company="Other Co")
            cl = _persist_cover_letter(db, other, other_job, name="Theirs")

            resp = client.post(
                f"/api/v1/cover-letters/{cl.id}/download-docx",
                cookies=_auth_cookies(str(test_user.id)),
            )
            assert resp.status_code == 404
        finally:
            db.query(CoverLetter).filter(CoverLetter.user_id == other.id).delete()
            db.query(Job).filter(Job.user_id == other.id).delete()
            db.commit()
            db.delete(other)
            db.commit()

    def test_download_docx_not_found_returns_404(
        self, client: TestClient, test_user: User, db
    ):
        """Random UUID → 404."""
        bogus_id = uuid.uuid4()
        resp = client.post(
            f"/api/v1/cover-letters/{bogus_id}/download-docx",
            cookies=_auth_cookies(str(test_user.id)),
        )
        assert resp.status_code == 404


class TestCoverLetterDownloadFreeOfCharge:
    """Cross-cutting check: neither download endpoint writes usage_log rows."""

    def test_neither_endpoint_writes_usage_log(
        self, client: TestClient, test_user: User, db
    ):
        """Hit both endpoints back-to-back; usage_log count must not move."""
        job = _create_job(db, test_user)
        cl = _persist_cover_letter(db, test_user, job, name="Free Letter")

        before = (
            db.query(UsageLog).filter(UsageLog.user_id == test_user.id).count()
        )

        fake_pdf = b"%PDF-1.4\n%stub\n%%EOF"
        with patch(
            "app.routers.cover_letters.pdf_service.render_pdf",
            new=AsyncMock(return_value=fake_pdf),
        ):
            pdf_resp = client.post(
                f"/api/v1/cover-letters/{cl.id}/download",
                cookies=_auth_cookies(str(test_user.id)),
            )
        assert pdf_resp.status_code == 200

        docx_resp = client.post(
            f"/api/v1/cover-letters/{cl.id}/download-docx",
            cookies=_auth_cookies(str(test_user.id)),
        )
        assert docx_resp.status_code == 200

        db.expire_all()
        after = (
            db.query(UsageLog).filter(UsageLog.user_id == test_user.id).count()
        )
        assert after == before
