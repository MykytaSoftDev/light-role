from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.auth import LoginRequest, RegisterRequest
from app.schemas.user import UserResponse
from app.services.auth_service import login_user, logout_user, refresh_tokens, register_user

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(data: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    return register_user(data, db, response)


@router.post("/login", response_model=UserResponse)
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    return login_user(data, db, response)


@router.post("/logout")
def logout(response: Response):
    return logout_user(response)


@router.post("/refresh")
def refresh(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: Optional[str] = Cookie(default=None),
):
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")
    return refresh_tokens(refresh_token, db, response)
