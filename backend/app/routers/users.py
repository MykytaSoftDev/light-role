from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, get_verified_user
from app.models.user import User
from app.schemas.usage import UsageResponse
from app.schemas.user import (
    DismissCompleteStepsResponse,
    UserResponse,
    UserUpdateRequest,
)

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    data: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
):
    from app.services.user_service import delete_user_account
    delete_user_account(current_user, db, response)
