"""
Template authorization helper.

Currently a stub that permits all templates for all users.
TODO: Replace with real plan enforcement when monetization is wired (tasks-monetization.json).
      The function signature is final — only the body changes.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User

# Templates that require Pro plan (informational — not enforced yet)
PRO_TEMPLATES = {"modern", "minimal"}


def user_can_use_template(user: "User", template_id: str) -> bool:
    """Return True if the user's plan permits using the given template.

    Stub: always returns True until monetization is implemented.
    """
    # TODO: check user.subscription_plan when monetization is wired
    return True
