"""
Pydantic models for resume template data contract.
1:1 mirror of frontend/src/lib/resume-templates/types.ts ResumeData interface.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class PersonalInfo(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin: Optional[str] = None
    website: Optional[str] = None
    summary: Optional[str] = None


class ExperienceItem(BaseModel):
    company: str = ""
    title: str = ""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    current: bool = False
    description: str = ""
    achievements: list[str] = Field(default_factory=list)


class EducationItem(BaseModel):
    institution: str = ""
    degree: str = ""
    field: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    gpa: Optional[str] = None


class CertificationItem(BaseModel):
    name: str = ""
    issuer: Optional[str] = None
    date: Optional[str] = None


class ResumeData(BaseModel):
    personal_info: PersonalInfo = Field(default_factory=PersonalInfo)
    summary: Optional[str] = None
    experience: list[ExperienceItem] = Field(default_factory=list)
    education: list[EducationItem] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    certifications: list[CertificationItem] = Field(default_factory=list)
