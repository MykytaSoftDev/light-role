import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator

from app.models.enums import AuthProvider
from app.services.font_css import SUPPORTED_FONTS

# ---------------------------------------------------------------------------
# Resume preferences (PREFS-1, PRD 3.8.3)
# ---------------------------------------------------------------------------

# Canonical 9 section keys for `users.resume_preferences.sections_order`.
# Mirror the order used in `app/models/user.py:_resume_preferences_default()`
# and the openai_service prompt (see app/ai/openai_service.py rule 4).
# Defined here so frontend / tests can grep one symbol.
KNOWN_SECTION_KEYS: tuple[str, ...] = (
    "summary",
    "employment",
    "education",
    "projects",
    "skills",
    "certificates",
    "languages",
    "achievements",
    "volunteer",
)

# Re-export SUPPORTED_FONTS as KNOWN_FONTS so the resume-preferences contract
# has a self-contained constant name. Both names point at the same tuple.
KNOWN_FONTS: tuple[str, ...] = SUPPORTED_FONTS


class ResumePreferences(BaseModel):
    """Full `users.resume_preferences` JSONB shape (PRD 3.8.3, PREFS-1).

    Read-path schema — kept loose (no enum constraints) so a stale value in the
    DB never breaks `GET /api/v1/users/me`. Write-path validation lives in
    `ResumePreferencesUpdateRequest`.
    """

    sections_order: list[str]
    font: str
    template: str

    model_config = {"from_attributes": True}


class ResumePreferencesUpdateRequest(BaseModel):
    """Partial-update body for PATCH /api/v1/users/me/resume-preferences.

    All three fields are optional; the router enforces "at least one provided".
    Field validators reject invalid values with 422 (Pydantic ValueError) for
    `font` and `sections_order`. `template` is router-side validated because
    its rejection is a 400 (locked-feature signal), not a 422 (bad shape).
    """

    sections_order: Optional[list[str]] = None
    font: Optional[str] = None
    template: Optional[str] = None

    @field_validator("font")
    @classmethod
    def _validate_font(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if v not in KNOWN_FONTS:
            raise ValueError(
                f"font must be one of {list(KNOWN_FONTS)}"
            )
        return v

    @field_validator("sections_order")
    @classmethod
    def _validate_sections_order(
        cls, v: Optional[list[str]]
    ) -> Optional[list[str]]:
        if v is None:
            return v
        # Must be a permutation of the 9 known keys with no duplicates.
        if len(v) != len(KNOWN_SECTION_KEYS):
            raise ValueError(
                f"sections_order must contain exactly {len(KNOWN_SECTION_KEYS)} "
                f"items, got {len(v)}"
            )
        if len(set(v)) != len(v):
            raise ValueError("sections_order must not contain duplicates")
        if set(v) != set(KNOWN_SECTION_KEYS):
            raise ValueError(
                f"sections_order must be a permutation of "
                f"{list(KNOWN_SECTION_KEYS)}"
            )
        return v


class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    first_name: Optional[str]
    last_name: Optional[str]
    auth_provider: AuthProvider
    is_verified: bool
    onboarding_completed: bool
    created_at: datetime
    # DASHBOARD-1: surfaced so the dashboard home knows whether to render
    # the "Complete steps" panel without a second round-trip.
    complete_steps_dismissed_at: Optional[datetime] = None
    # PREFS-1: surfaced so the resume editor / preferences page can hydrate
    # without a second round-trip.
    resume_preferences: ResumePreferences

    model_config = {"from_attributes": True}


class DismissCompleteStepsResponse(BaseModel):
    """Returned by POST /api/v1/users/me/dismiss-complete-steps (DASHBOARD-1)."""

    complete_steps_dismissed_at: datetime


class UserUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None

    @classmethod
    def normalize_email(cls, v: Optional[str]) -> Optional[str]:
        return v.lower().strip() if v else v
