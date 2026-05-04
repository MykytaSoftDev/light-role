"""Service helpers for the v2.1 user profile (PRD 3.3.16, 6.4)."""
from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.profile import UserProfile
from app.schemas.profile import ProfilePatchRequest

logger = logging.getLogger(__name__)


def get_or_create_profile(user_id: UUID, db: Session) -> UserProfile:
    """Return the user's profile row, auto-creating an empty one if missing.

    Per PRD 3.3.16, GET /api/v1/profile must always succeed for an
    authenticated user — if no row exists yet, create one with an empty
    ``profile_data`` blob and return it.
    """
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if profile is not None:
        return profile

    profile = UserProfile(user_id=user_id, profile_data={})
    db.add(profile)
    db.commit()
    db.refresh(profile)
    logger.info(f"Created empty profile for user {user_id}")
    return profile


def merge_profile_sections(
    profile: UserProfile,
    patch: ProfilePatchRequest,
    db: Session,
) -> UserProfile:
    """Merge the provided sections from ``patch`` into ``profile.profile_data``.

    Section-level replacement: each key in the patch payload (e.g. ``employment``)
    overwrites the corresponding key in ``profile_data`` wholesale. Sections the
    client did not send are left untouched. This matches the PRD task acceptance
    criteria for PROFILE-1 (PATCH accepts partial JSONB and merges only the
    provided sections).

    JSONB mutation tracking: we reassign ``profile.profile_data`` to a brand-new
    dict so SQLAlchemy reliably detects the change (in-place dict mutation on a
    JSONB column is not tracked by default).
    """
    # exclude_unset=True → only sections the client explicitly sent are present.
    # mode="json" recursively serializes nested Pydantic models (UUID, datetime,
    # nested BaseModel instances) into JSONB-safe primitives.
    updates = patch.model_dump(exclude_unset=True, mode="json")

    if not updates:
        # Nothing to merge — return as-is without touching the row.
        return profile

    current = profile.profile_data or {}
    profile.profile_data = {**current, **updates}

    db.commit()
    db.refresh(profile)
    logger.info(
        f"Updated profile for user {profile.user_id}; "
        f"sections={sorted(updates.keys())}"
    )
    return profile
