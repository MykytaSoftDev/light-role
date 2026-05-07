"""Tests for GET / PATCH / DELETE / rating /api/v1/tailored-resumes/{id}
(TAILOR-8 + TAILOR-14).

These complete the editor mount + inline-rename round-trip the wizard flow
relies on, plus the rating-modal flow and hard delete from TAILOR-14. Auth
model and ownership semantics mirror the download endpoint (see
test_tailored_resume_download.py): both "not found" and "owned by another
user" return 404 to avoid existence leaks.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models.ai_quality_rating import AIQualityRating
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
    # ai_quality_ratings.user_id has ondelete=CASCADE too so deleting the
    # user wipes any leftover ratings — explicit delete is belt-and-braces
    # to keep teardown order independent of FK config drift.
    db.query(AIQualityRating).filter(AIQualityRating.user_id == user.id).delete()
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


# ---------------------------------------------------------------------------
# POST /api/v1/tailored-resumes/{id}/rating  (TAILOR-14)
# ---------------------------------------------------------------------------


class TestPostTailoredResumeRating:
    def test_create_rating_success(
        self, client: TestClient, test_user: User, db
    ):
        """Owner submits valid 1-5 rating with comment → 201, row persisted."""
        job = _create_job(db, test_user)
        row = _create_tailored_resume(db, test_user, job)

        resp = client.post(
            f"/api/v1/tailored-resumes/{row.id}/rating",
            cookies=_auth_cookies(str(test_user.id)),
            json={"rating": 4, "comment": "Solid output"},
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["rating"] == 4
        assert body["comment"] == "Solid output"
        assert body["tailored_resume_id"] == str(row.id)
        assert body["user_id"] == str(test_user.id)
        assert "id" in body
        assert "created_at" in body

        # DB persistence.
        db.expire_all()
        persisted = (
            db.query(AIQualityRating)
            .filter(AIQualityRating.tailored_resume_id == row.id)
            .first()
        )
        assert persisted is not None
        assert persisted.rating == 4
        assert persisted.comment == "Solid output"

    def test_create_rating_without_comment(
        self, client: TestClient, test_user: User, db
    ):
        """Comment is optional → 201 with comment=None persisted."""
        job = _create_job(db, test_user)
        row = _create_tailored_resume(db, test_user, job)

        resp = client.post(
            f"/api/v1/tailored-resumes/{row.id}/rating",
            cookies=_auth_cookies(str(test_user.id)),
            json={"rating": 5},
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["comment"] is None

    def test_create_rating_too_low(
        self, client: TestClient, test_user: User, db
    ):
        """rating=0 fails Pydantic ge=1 → 422 (no DB write)."""
        job = _create_job(db, test_user)
        row = _create_tailored_resume(db, test_user, job)

        resp = client.post(
            f"/api/v1/tailored-resumes/{row.id}/rating",
            cookies=_auth_cookies(str(test_user.id)),
            json={"rating": 0},
        )
        assert resp.status_code == 422

        db.expire_all()
        assert (
            db.query(AIQualityRating)
            .filter(AIQualityRating.tailored_resume_id == row.id)
            .count()
            == 0
        )

    def test_create_rating_too_high(
        self, client: TestClient, test_user: User, db
    ):
        """rating=6 fails Pydantic le=5 → 422."""
        job = _create_job(db, test_user)
        row = _create_tailored_resume(db, test_user, job)

        resp = client.post(
            f"/api/v1/tailored-resumes/{row.id}/rating",
            cookies=_auth_cookies(str(test_user.id)),
            json={"rating": 6},
        )
        assert resp.status_code == 422

    def test_create_rating_duplicate_returns_409(
        self, client: TestClient, test_user: User, db
    ):
        """Second rating for same resume violates UNIQUE → 409."""
        job = _create_job(db, test_user)
        row = _create_tailored_resume(db, test_user, job)

        first = client.post(
            f"/api/v1/tailored-resumes/{row.id}/rating",
            cookies=_auth_cookies(str(test_user.id)),
            json={"rating": 3},
        )
        assert first.status_code == 201, first.text

        second = client.post(
            f"/api/v1/tailored-resumes/{row.id}/rating",
            cookies=_auth_cookies(str(test_user.id)),
            json={"rating": 5, "comment": "Trying to overwrite"},
        )
        assert second.status_code == 409
        # Persisted row remains the first rating, not the second.
        db.expire_all()
        persisted = (
            db.query(AIQualityRating)
            .filter(AIQualityRating.tailored_resume_id == row.id)
            .one()
        )
        assert persisted.rating == 3
        assert persisted.comment is None

    def test_create_rating_not_owned(
        self, client: TestClient, test_user: User, db
    ):
        """Resume owned by another user → 404 (don't leak existence)."""
        other = _create_user(db)
        try:
            other_job = _create_job(db, other)
            other_row = _create_tailored_resume(db, other, other_job)

            resp = client.post(
                f"/api/v1/tailored-resumes/{other_row.id}/rating",
                cookies=_auth_cookies(str(test_user.id)),
                json={"rating": 5},
            )
            assert resp.status_code == 404

            # No rating row was created for the other user's resume.
            db.expire_all()
            assert (
                db.query(AIQualityRating)
                .filter(AIQualityRating.tailored_resume_id == other_row.id)
                .count()
                == 0
            )
        finally:
            db.query(AIQualityRating).filter(
                AIQualityRating.user_id == other.id
            ).delete()
            db.query(TailoredResume).filter(
                TailoredResume.user_id == other.id
            ).delete()
            db.query(Job).filter(Job.user_id == other.id).delete()
            db.commit()
            db.delete(other)
            db.commit()

    def test_create_rating_not_found(
        self, client: TestClient, test_user: User
    ):
        """Non-existent resume UUID → 404."""
        resp = client.post(
            f"/api/v1/tailored-resumes/{uuid.uuid4()}/rating",
            cookies=_auth_cookies(str(test_user.id)),
            json={"rating": 4},
        )
        assert resp.status_code == 404

    def test_create_rating_unauthenticated(
        self, client: TestClient, test_user: User, db
    ):
        """Missing cookie → 401."""
        job = _create_job(db, test_user)
        row = _create_tailored_resume(db, test_user, job)
        resp = client.post(
            f"/api/v1/tailored-resumes/{row.id}/rating",
            json={"rating": 4},
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /api/v1/tailored-resumes/{id}/rating-modal-shown  (TAILOR-14)
# ---------------------------------------------------------------------------


class TestPostRatingModalShown:
    def test_modal_shown_sets_timestamp(
        self, client: TestClient, test_user: User, db
    ):
        """First call sets `rating_modal_shown_at` from NULL → 200 with value."""
        job = _create_job(db, test_user)
        row = _create_tailored_resume(db, test_user, job)
        assert row.rating_modal_shown_at is None

        resp = client.post(
            f"/api/v1/tailored-resumes/{row.id}/rating-modal-shown",
            cookies=_auth_cookies(str(test_user.id)),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["rating_modal_shown_at"] is not None

        # DB-side: timestamp is now set.
        db.expire_all()
        refreshed = (
            db.query(TailoredResume).filter(TailoredResume.id == row.id).first()
        )
        assert refreshed.rating_modal_shown_at is not None

    def test_modal_shown_idempotent(
        self, client: TestClient, test_user: User, db
    ):
        """Second call is a DB-level no-op: timestamp unchanged, still 200."""
        job = _create_job(db, test_user)
        row = _create_tailored_resume(db, test_user, job)

        first = client.post(
            f"/api/v1/tailored-resumes/{row.id}/rating-modal-shown",
            cookies=_auth_cookies(str(test_user.id)),
        )
        assert first.status_code == 200
        first_ts = first.json()["rating_modal_shown_at"]
        assert first_ts is not None

        # Capture DB value after first call.
        db.expire_all()
        after_first = (
            db.query(TailoredResume).filter(TailoredResume.id == row.id).first()
        )
        original_ts = after_first.rating_modal_shown_at

        second = client.post(
            f"/api/v1/tailored-resumes/{row.id}/rating-modal-shown",
            cookies=_auth_cookies(str(test_user.id)),
        )
        assert second.status_code == 200
        # Returned value matches the original timestamp (DB-level no-op
        # via WHERE rating_modal_shown_at IS NULL on the UPDATE).
        assert second.json()["rating_modal_shown_at"] == first_ts

        # And the DB column is byte-for-byte unchanged.
        db.expire_all()
        after_second = (
            db.query(TailoredResume).filter(TailoredResume.id == row.id).first()
        )
        assert after_second.rating_modal_shown_at == original_ts

    def test_modal_shown_not_owned(
        self, client: TestClient, test_user: User, db
    ):
        """Resume owned by another user → 404."""
        other = _create_user(db)
        try:
            other_job = _create_job(db, other)
            other_row = _create_tailored_resume(db, other, other_job)

            resp = client.post(
                f"/api/v1/tailored-resumes/{other_row.id}/rating-modal-shown",
                cookies=_auth_cookies(str(test_user.id)),
            )
            assert resp.status_code == 404

            # Timestamp on the other user's row was NOT touched.
            db.expire_all()
            refreshed = (
                db.query(TailoredResume)
                .filter(TailoredResume.id == other_row.id)
                .first()
            )
            assert refreshed.rating_modal_shown_at is None
        finally:
            db.query(TailoredResume).filter(
                TailoredResume.user_id == other.id
            ).delete()
            db.query(Job).filter(Job.user_id == other.id).delete()
            db.commit()
            db.delete(other)
            db.commit()

    def test_modal_shown_not_found(
        self, client: TestClient, test_user: User
    ):
        """Non-existent resume UUID → 404."""
        resp = client.post(
            f"/api/v1/tailored-resumes/{uuid.uuid4()}/rating-modal-shown",
            cookies=_auth_cookies(str(test_user.id)),
        )
        assert resp.status_code == 404

    def test_modal_shown_unauthenticated(
        self, client: TestClient, test_user: User, db
    ):
        """Missing cookie → 401."""
        job = _create_job(db, test_user)
        row = _create_tailored_resume(db, test_user, job)
        resp = client.post(
            f"/api/v1/tailored-resumes/{row.id}/rating-modal-shown",
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# DELETE /api/v1/tailored-resumes/{id}  (TAILOR-14)
# ---------------------------------------------------------------------------


class TestDeleteTailoredResume:
    def test_delete_success(
        self, client: TestClient, test_user: User, db
    ):
        """Owner DELETE → 204, row gone from DB."""
        job = _create_job(db, test_user)
        row = _create_tailored_resume(db, test_user, job)
        row_id = row.id

        resp = client.delete(
            f"/api/v1/tailored-resumes/{row_id}",
            cookies=_auth_cookies(str(test_user.id)),
        )
        assert resp.status_code == 204
        assert resp.content == b""

        db.expire_all()
        assert (
            db.query(TailoredResume).filter(TailoredResume.id == row_id).first()
            is None
        )

    def test_delete_cascades_to_rating(
        self, client: TestClient, test_user: User, db
    ):
        """DELETE on a resume with a rating → cascades, both rows gone."""
        job = _create_job(db, test_user)
        row = _create_tailored_resume(db, test_user, job)
        row_id = row.id

        # Insert a rating directly so we don't depend on the rating endpoint.
        rating = AIQualityRating(
            user_id=test_user.id,
            tailored_resume_id=row_id,
            rating=5,
            comment="Great",
        )
        db.add(rating)
        db.commit()
        rating_id = rating.id

        resp = client.delete(
            f"/api/v1/tailored-resumes/{row_id}",
            cookies=_auth_cookies(str(test_user.id)),
        )
        assert resp.status_code == 204

        db.expire_all()
        # Resume is gone.
        assert (
            db.query(TailoredResume).filter(TailoredResume.id == row_id).first()
            is None
        )
        # And the FK CASCADE took the rating with it.
        assert (
            db.query(AIQualityRating)
            .filter(AIQualityRating.id == rating_id)
            .first()
            is None
        )

    def test_delete_not_owned(
        self, client: TestClient, test_user: User, db
    ):
        """Resume owned by another user → 404, row preserved."""
        other = _create_user(db)
        try:
            other_job = _create_job(db, other)
            other_row = _create_tailored_resume(db, other, other_job)
            other_row_id = other_row.id

            resp = client.delete(
                f"/api/v1/tailored-resumes/{other_row_id}",
                cookies=_auth_cookies(str(test_user.id)),
            )
            assert resp.status_code == 404

            # Row was NOT deleted.
            db.expire_all()
            assert (
                db.query(TailoredResume)
                .filter(TailoredResume.id == other_row_id)
                .first()
                is not None
            )
        finally:
            db.query(TailoredResume).filter(
                TailoredResume.user_id == other.id
            ).delete()
            db.query(Job).filter(Job.user_id == other.id).delete()
            db.commit()
            db.delete(other)
            db.commit()

    def test_delete_not_found(
        self, client: TestClient, test_user: User
    ):
        """Non-existent UUID → 404."""
        resp = client.delete(
            f"/api/v1/tailored-resumes/{uuid.uuid4()}",
            cookies=_auth_cookies(str(test_user.id)),
        )
        assert resp.status_code == 404

    def test_delete_unauthenticated(
        self, client: TestClient, test_user: User, db
    ):
        """Missing cookie → 401."""
        job = _create_job(db, test_user)
        row = _create_tailored_resume(db, test_user, job)
        resp = client.delete(f"/api/v1/tailored-resumes/{row.id}")
        assert resp.status_code == 401
