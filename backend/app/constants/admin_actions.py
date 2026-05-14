"""Admin action constants for `admin_audit_logs.action` (SPEC §4.2).

Action values are loose strings in the DB to avoid migration friction when
new actions are added. This module is the single source of truth for the
allowed action identifiers — services must reference these constants
instead of inlining string literals so a typo can't silently produce an
unfilterable audit row.
"""


class AdminAction:
    # Impersonation
    IMPERSONATION_START = "impersonation.start"
    IMPERSONATION_STOP = "impersonation.stop"

    # Subscription
    SUBSCRIPTION_GRANT_PRO = "subscription.grant_pro"
    SUBSCRIPTION_CANCEL_MANUAL = "subscription.cancel_manual"
    SUBSCRIPTION_RESET_CYCLE = "subscription.reset_cycle"

    # Usage
    USAGE_RESET_AI_OPS = "usage.reset_ai_ops"

    # User (reserved for Phase 2+ — not used in Phase 1)
    USER_BAN = "user.ban"
    USER_UNBAN = "user.unban"
