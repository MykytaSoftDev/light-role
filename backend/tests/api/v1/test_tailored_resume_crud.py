"""Tests for GET / PATCH /api/v1/tailored-resumes/{id} (TAILOR-8).

These complete the editor mount + inline-rename round-trip the wizard flow
relies on. Auth model and ownership semantics mirror the download endpoint
(see test_tailored_resume_download.py): both "not found" and "owned by
another user" return 404 to avoid existence leaks.
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
# Helpers (kept self-contained to mirror sibling test files).
# ---------------------------------------------------------------------------


def _create_user(db) -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"tr_crud_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("TestPass123!"),
        first_name="CRUD",
        last_name="Tester",
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _create_job(
    db,
    user: User,
    *,
    title: str = "Senior Engineer",
    company: str = "Acme Corp",
) -> Job:
    job = Job(
        id=uuid.uuid4(),
        user_id=user.id,
        title=title,
        company=company,
        description_raw="x",
        requirements=[],
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def _profile_data() -> dict:
    """Minimal but ProfileData-shaped dict (PRD 6.4)."""
    return {
        "personal_info": {
            "full_name": "Test User",
            "email": "test@example.com",
            "phone": "+1-555-0100",
        },
        "summary": "Senior engineer.",
        "employment": [],
        "education": [],
        "skills": [],
        "projects": [],
        "languages": [],
        "certificates": [],
        "achievements": [],
        "volunteer": [],
    }


def _create_tailored_resume(
    db,
    user: User,
    job: Job,
    *,
    name: str = "Senior Engineer — Acme Corp",
) -> TailoredResume:
    row = TailoredResume(
        user_id=user.id,
        job_id=job.id,
        name=name,
        profile_snapshot=_profile_data(),
        tailored_data=_profile_data(),
        matched_keywords=[{"term": "Python", "color_id": 1}],
        applied_changes={"summary": ["Rephrased opening line."]},
        match_score=80,
        sections_order_snapshot=["personal_info", "summary", "employment"],
        font_snapshot="Inter",
        template_snapshot="classic",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


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
    # Cascading FK from tailored_resumes/jobs → user means we just need to
    # null-out children that don't cascade automatically before deleting
    # the user. Hard cleanup of jobs handles tailored_resumes via CASCADE.
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
# GET /api/v1/tailored-resumes/{id}
# ---------------------------------------------------------------------------


class TestGetTailoredResume:
    def test_get_tailored_resume_success(
        self, client: TestClient, test_user: User, db
    ):
        """Owner can GET; response includes joined job_title + job_company."""
        job = _create_job(db, test_user, title="Backend Eng", company="Globex")
        row = _create_tailored_resume(db, test_user, job)

        resp = client.get(
            f"/api/v1/tailored-resumes/{row.id}",
            cookies=_auth_cookies(str(test_user.id)),
        )

        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["id"] == str(row.id)
        assert body["user_id"] == str(test_user.id)
        assert body["job_id"] == str(job.id)
        assert body["match_score"] == 80
        # Joined-Job fields populated from the eager-loaded relationship.
        assert body["job_title"] == "Backend Eng"
        assert body["job_company"] == "Globex"
        # Heavy snapshot fields are present (full response, not the list shape).
        assert "tailored_data" in body
        assert "profile_snapshot" in body
        assert "matched_keywords" in body
        assert "applied_changes" in body

    def test_get_tailored_resume_not_found(
        self, client: TestClient, test_user: User
    ):
        """Non-existent UUID → 404."""
        resp = client.get(
            f"/api/v1/tailored-resumes/{uuid.uuid4()}",
            cookies=_auth_cookies(str(test_user.id)),
        )
        assert resp.status_code == 404

    def test_get_tailored_resume_not_owned(
        self, client: TestClient, test_user: User, db
    ):
        """Resume owned by another user → 404 (don't leak existence as 403)."""
        other = _create_user(db)
        try:
            other_job = _create_job(db, other, title="Other", company="Other Co")
            other_row = _create_tailored_resume(db, other, other_job)

            resp = client.get(
                f"/api/v1/tailored-resumes/{other_row.id}",
                cookies=_auth_cookies(str(test_user.id)),
            )
            assert resp.status_code == 404
        finally:
            db.query(TailoredResume).filter(
                TailoredResume.user_id == other.id
            ).delete()
            db.query(Job).filter(Job.user_id == other.id).delete()
            db.commit()
            db.delete(other)
            db.commit()

    def test_get_tailored_resume_unauthenticated(
        self, client: TestClient, test_user: User, db
    ):
        """Missing cookie → 401."""
        job = _create_job(db, test_user)
        row = _create_tailored_resume(db, test_user, job)
        resp = client.get(f"/api/v1/tailored-resumes/{row.id}")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# PATCH /api/v1/tailored-resumes/{id}
# ---------------------------------------------------------------------------


class TestPatchTailoredResume:
    def test_patch_tailored_resume_name(
        self, client: TestClient, test_user: User, db
    ):
        """Inline filename rename → updated row + response carries new name."""
        job = _create_job(db, test_user)
        row = _create_tailored_resume(db, test_user, job)

        resp = client.patch(
            f"/api/v1/tailored-resumes/{row.id}",
            cookies=_auth_cookies(str(test_user.id)),
            json={"name": "My Custom Resume Name"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["name"] == "My Custom Resume Name"

        # DB-side persisted.
        db.expire_all()
        refreshed = (
            db.query(TailoredResume).filter(TailoredResume.id == row.id).first()
        )
        assert refreshed.name == "My Custom Resume Name"

    def test_patch_tailored_resume_tailored_data(
        self, client: TestClient, test_user: User, db
    ):
        """Editor can patch the full tailored_data ProfileData blob."""
        job = _create_job(db, test_user)
        row = _create_tailored_resume(db, test_user, job)

        new_data = _profile_data()
        new_data["summary"] = "Edited summary from the editor."

        resp = client.patch(
            f"/api/v1/tailored-resumes/{row.id}",
            cookies=_auth_cookies(str(test_user.id)),
            json={"tailored_data": new_data},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["tailored_data"]["summary"] == "Edited summary from the editor."

    def test_patch_tailored_resume_immutable_fields_ignored(
        self, client: TestClient, test_user: User, db
    ):
        """Snapshot fields the schema strips must NOT mutate the row."""
        job = _create_job(db, test_user)
        row = _create_tailored_resume(db, test_user, job)
        original_score = row.match_score
        original_template = row.template_snapshot
        original_profile_snapshot = dict(row.profile_snapshot)

        resp = client.patch(
            f"/api/v1/tailored-resumes/{row.id}",
            cookies=_auth_cookies(str(test_user.id)),
            json={
                # All of these are intentionally absent from the patch schema —
                # they should be silently dropped and never reach the row.
                "match_score": 1,
                "matched_keywords": [],
                "applied_changes": {},
                "profile_snapshot": {"personal_info": {"full_name": "Hacker"}},
                "template_snapshot": "modern",
                # Plus a real allowed change so the request is not a no-op.
                "name": "Renamed",
            },
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["name"] == "Renamed"
        assert body["match_score"] == original_score
        assert body["template_snapshot"] == original_template

        # DB confirms.
        db.expire_all()
        refreshed = (
            db.query(TailoredResume).filter(TailoredResume.id == row.id).first()
        )
        assert refreshed.match_score == original_score
        assert refreshed.template_snapshot == original_template
        assert refreshed.profile_snapshot == original_profile_snapshot

    def test_patch_tailored_resume_validation_error(
        self, client: TestClient, test_user: User, db
    ):
        """Empty `name` violates min_length=1 → 422."""
        job = _create_job(db, test_user)
        row = _create_tailored_resume(db, test_user, job)

        resp = client.patch(
            f"/api/v1/tailored-resumes/{row.id}",
            cookies=_auth_cookies(str(test_user.id)),
            json={"name": ""},
        )
        assert resp.status_code == 422

    def test_patch_tailored_resume_not_found(
        self, client: TestClient, test_user: User
    ):
        """Non-existent UUID → 404."""
        resp = client.patch(
            f"/api/v1/tailored-resumes/{uuid.uuid4()}",
            cookies=_auth_cookies(str(test_user.id)),
            json={"name": "Anything"},
        )
        assert resp.status_code == 404

    def test_patch_tailored_resume_not_owned(
        self, client: TestClient, test_user: User, db
    ):
        """Resume owned by another user → 404 (don't leak existence)."""
        other = _create_user(db)
        try:
            other_job = _create_job(db, other)
            other_row = _create_tailored_resume(db, other, other_job)

            resp = client.patch(
                f"/api/v1/tailored-resumes/{other_row.id}",
                cookies=_auth_cookies(str(test_user.id)),
                json={"name": "Hijack"},
            )
            assert resp.status_code == 404

            # Confirm the row was NOT touched.
            db.expire_all()
            refreshed = (
                db.query(TailoredResume)
                .filter(TailoredResume.id == other_row.id)
                .first()
            )
            assert refreshed.name != "Hijack"
        finally:
            db.query(TailoredResume).filter(
                TailoredResume.user_id == other.id
            ).delete()
            db.query(Job).filter(Job.user_id == other.id).delete()
            db.commit()
            db.delete(other)
            db.commit()

    def test_patch_tailored_resume_unauthenticated(
        self, client: TestClient, test_user: User, db
    ):
        """Missing cookie → 401."""
        job = _create_job(db, test_user)
        row = _create_tailored_resume(db, test_user, job)
        resp = client.patch(
            f"/api/v1/tailored-resumes/{row.id}",
            json={"name": "Anything"},
        )
        assert resp.status_code == 401
