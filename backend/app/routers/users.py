from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, get_verified_user
from app.dependencies.impersonation import (
    SessionContext,
    block_during_impersonation,
    get_session_context,
)
from app.models.user import User, _resume_preferences_default
from app.schemas.usage import UsageResponse
from app.schemas.user import (
    DismissCompleteStepsResponse,
    ResumePreferences,
    ResumePreferencesUpdateRequest,
    UserResponse,
    UserUpdateRequest,
)

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
def get_me(
    session_ctx: SessionContext = Depends(get_session_context),
):
    """Return the effective acting user (SPEC §5.7, §6.6).

    During impersonation `session_ctx.user` is the impersonated user, so
    the dashboard renders as them; `is_impersonating` + `impersonator_email`
    are surfaced for the global ImpersonationBanner. For normal sessions
    the two extra fields fall back to their defaults (False / None).
    """
    base = UserResponse.model_validate(session_ctx.user)
    if session_ctx.is_impersonating and session_ctx.impersonator is not None:
        # UserResponse is a mutable Pydantic v2 model (no `frozen=True`)
        # so direct field assignment is safe and avoids the model_copy
        # round-trip.
        base.is_impersonating = True
        base.impersonator_email = session_ctx.impersonator.email
    return base


@router.patch("/me", response_model=UserResponse)
def update_me(
    data: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    session_ctx: SessionContext = Depends(get_session_context),
):
    # SPEC §6.7: email changes are blocked during impersonation (identity
    # change). Name updates remain allowed — useful for debugging UX bugs
    # tied to specific display-name values without forcing the admin to
    # exit impersonation.
    if session_ctx.is_impersonating and data.email is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot change email during impersonation",
        )

    if data.first_name is not None:
        current_user.first_name = data.first_name
    if data.last_name is not None:
        current_user.last_name = data.last_name
    if data.email is not None:
        existing = db.query(User).filter(
            User.email == data.email.lower(),
            User.id != current_user.id,
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email already taken")
        current_user.email = data.email.lower()

    db.commit()
    db.refresh(current_user)
    return current_user


@router.patch(
    "/me/resume-preferences",
    response_model=ResumePreferences,
)
def update_resume_preferences(
    data: ResumePreferencesUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """Partial-merge update of `users.resume_preferences` (PREFS-1, PRD 3.8.3).

    Semantics:
      - At least one of `sections_order`, `font`, `template` must be provided
        (empty body → 400).
      - `template` is locked to "classic" for MVP — any other value → 400.
      - `font` and `sections_order` shape errors are handled by the Pydantic
        validators on the request schema (422).
      - The full post-merge object is returned so the frontend can replace
        its cache atomically (no need for a follow-up GET /me).

    Idempotent: sending the same payload twice yields the same final state.
    """
    # 1. At-least-one-field guard (cannot live in Pydantic without an awkward
    # model_validator; clearer here as it's a 400, not a 422).
    if (
        data.sections_order is None
        and data.font is None
        and data.template is None
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "At least one of sections_order, font, template must be "
                "provided."
            ),
        )

    # 2. Locked-feature gate for `template`. Returning 400 (not 422) signals
    # "the value parses fine, the feature is just not available" — the
    # frontend can render this differently from a malformed-input toast.
    if data.template is not None and data.template != "classic":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only the 'classic' template is available in this release."
            ),
        )

    # 3. Build the full merged dict on top of defaults so any keys missing
    # from the stored row (e.g., from a partially-migrated record) are filled
    # in. Defaults come from the same source the model uses for new users.
    merged = _resume_preferences_default()
    if current_user.resume_preferences:
        merged.update(current_user.resume_preferences)
    if data.sections_order is not None:
        merged["sections_order"] = data.sections_order
    if data.font is not None:
        merged["font"] = data.font
    if data.template is not None:
        merged["template"] = data.template

    # 4. Reassign the whole dict so SQLAlchemy notices the change. JSONB
    # in-place mutation is NOT tracked unless wrapped in MutableDict, and
    # this column isn't.
    current_user.resume_preferences = merged
    db.commit()
    db.refresh(current_user)
    return ResumePreferences(**current_user.resume_preferences)


@router.get("/me/usage", response_model=UsageResponse)
async def get_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    from app.services.usage_service import get_usage as usage_service_get_usage
    return await usage_service_get_usage(current_user, db)


@router.post("/me/dismiss-complete-steps", response_model=DismissCompleteStepsResponse)
def dismiss_complete_steps(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """Dismiss the dashboard's Complete Steps panel (DASHBOARD-1).

    Idempotent: if `complete_steps_dismissed_at` is already set, return the
    existing timestamp unchanged (200, not 409). Setting the column to the
    server-side `now()` is a one-way switch; the panel never reappears.
    """
    if current_user.complete_steps_dismissed_at is None:
        current_user.complete_steps_dismissed_at = datetime.now(timezone.utc).replace(
            tzinfo=None
        )
        db.commit()
        db.refresh(current_user)
    return DismissCompleteStepsResponse(
        complete_steps_dismissed_at=current_user.complete_steps_dismissed_at
    )


@router.delete("/me", status_code=204)
def delete_me(
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    # SPEC §6.7: account deletion is destructive and identity-changing;
    # admins must exit impersonation before deleting the target user.
    _: None = Depends(block_during_impersonation),
):
    from app.services.user_service import delete_user_account
    delete_user_account(current_user, db, response)
