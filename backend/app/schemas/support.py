from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class SupportCategory(str, Enum):
    ACCOUNT = "account"
    BILLING = "billing"
    TECHNICAL = "technical"
    OTHER = "other"


class SupportContactRequest(BaseModel):
    subject: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=10, max_length=5000)
    category: SupportCategory


class SupportContactResponse(BaseModel):
    success: bool = True
    message: str
