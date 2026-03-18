from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_verified_user
from app.dependencies.rate_limit import (
    forgot_password_rate_limit,
    login_rate_limit,
    register_rate_limit,
)
from app.schemas.auth import ChangePasswordRequest, ForgotPasswordRequest, GoogleOAuthRequest, LoginRequest, RegisterRequest, ResetPasswordRequest, VerifyEmailRequest
from app.schemas.user import UserResponse
from app.services.auth_service import (
    change_password,
    forgot_password,
    login_user,
    logout_user,
    refresh_tokens,
    register_user,
    reset_password,
    verify_email_user,
)
from app.services.oauth_service import google_oauth_login

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", status_code=201)
async def register(
    data: RegisterRequest,
    db: Session = Depends(get_db),
    _: None = Depends(register_rate_limit),
):
    return await register_user(data, db)


@router.post("/verify-email")
async def verify_email(data: VerifyEmailRequest, response: Response, db: Session = Depends(get_db)):
    return await verify_email_user(data.token, db, response)


@router.post("/login", response_model=UserResponse)
async def login(
    data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
    _: None = Depends(login_rate_limit),
):
    return login_user(data, db, response)


@router.post("/logout")
def logout(response: Response):
    return logout_user(response)


@router.post("/forgot-password")
async def forgot_password_endpoint(
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db),
    _: None = Depends(forgot_password_rate_limit),
):
    return await forgot_password(data, db)


@router.post("/reset-password")
async def reset_password_endpoint(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    return await reset_password(data, db)


@router.post("/refresh")
def refresh(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: Optional[str] = Cookie(default=None),
):
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")
    return refresh_tokens(refresh_token, db, response)


@router.post("/oauth/google", response_model=UserResponse)
async def google_oauth(
    data: GoogleOAuthRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    return await google_oauth_login(data.code, data.redirect_uri, db, response)


@router.post("/change-password")
def change_password_endpoint(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_verified_user),
):
    return change_password(data, current_user, db)
