"""Convenience re-exports for the v2.1 schemas commonly imported by
downstream phases (3.2, 3.4, 3.6, 4). Sub-schemas (entry types,
sub-objects) are intentionally not re-exported — import them directly
from their module when needed.
"""
from app.schemas.ai_quality_rating import (
    AIQualityRatingCreateRequest,
    AIQualityRatingResponse,
)
from app.schemas.profile import (
    ProfileData,
    ProfilePatchRequest,
    ProfileReadinessResponse,
    ProfileResponse,
)
from app.schemas.tailored_resume import (
    AppliedChanges,
    MatchedKeyword,
    TailoredResumeData,
    TailoredResumeGenerationResult,
    TailoredResumeListResponse,
    TailoredResumePatchRequest,
    TailoredResumeResponse,
)

__all__ = [
    "AIQualityRatingCreateRequest",
    "AIQualityRatingResponse",
    "AppliedChanges",
    "MatchedKeyword",
    "ProfileData",
    "ProfilePatchRequest",
    "ProfileReadinessResponse",
    "ProfileResponse",
    "TailoredResumeData",
    "TailoredResumeGenerationResult",
    "TailoredResumeListResponse",
    "TailoredResumePatchRequest",
    "TailoredResumeResponse",
]
