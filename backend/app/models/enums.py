from enum import Enum


class AuthProvider(str, Enum):
    EMAIL = "email"
    GOOGLE = "google"


class ApplicationStatus(str, Enum):
    SAVED = "saved"
    APPLIED = "applied"
    SCREENING = "screening"
    INTERVIEW = "interview"
    OFFER = "offer"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class FileFormat(str, Enum):
    PDF = "pdf"
    DOCX = "docx"


# DEPRECATED — replaced by VARCHAR string in usage_log v2.1 ARCH-9; kept
# temporarily, remove in cleanup pass.
class OperationType(str, Enum):
    JOB_PARSE = "job_parse"
    RESUME_ANALYZE = "resume_analyze"
    CL_GENERATE = "cl_generate"
    CL_REGENERATE = "cl_regenerate"


class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    CANCELLED = "cancelled"
    PAST_DUE = "past_due"
    PAUSED = "paused"


class CLStyle(str, Enum):
    FORMAL = "formal"
    PROFESSIONAL = "professional"
    JOB_MATCHED = "job_matched"


class CLTone(str, Enum):
    CONFIDENT = "confident"
    HUMBLE = "humble"
    ENTHUSIASTIC = "enthusiastic"


class CLLength(str, Enum):
    SHORT = "short"
    MEDIUM = "medium"
    LONG = "long"


class NotificationType(str, Enum):
    FOLLOW_UP = "follow_up"
    INACTIVITY = "inactivity"
    LIMIT_WARNING = "limit_warning"
    LIMIT_RESET = "limit_reset"
    RESUME_READY = "resume_ready"
    COVER_LETTER_READY = "cover_letter_ready"


class FeedbackType(str, Enum):
    BUG = "bug"
    FEATURE_REQUEST = "feature_request"
    IMPROVEMENT = "improvement"
    OTHER = "other"


class FeedbackStatus(str, Enum):
    NEW = "new"
    REVIEWED = "reviewed"
    PLANNED = "planned"
    DONE = "done"
    DECLINED = "declined"
