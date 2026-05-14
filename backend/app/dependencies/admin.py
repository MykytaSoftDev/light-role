"""Admin access-control dependency (SPEC §3.2, §4.3).

`get_current_admin_user` wraps `get_current_user` and gates every
`/api/v1/admin/*` route. The 404 status (instead of 403) is intentional
and load-bearing — see comment in the function body.
"""

from fastapi import Depends, HTTPException

from app.dependencies.auth import get_current_user
from app.models.user import User


def get_current_admin_user(
    current_user: User = Depends(get_current_user),
) -> User:
    # 404 (not 403) is intentional: hides the existence of admin endpoints
    # from non-admins so probing /api/v1/admin/* is indistinguishable from
    # hitting any other unknown URL (SPEC §3.2).
    if not current_user.is_admin:
        raise HTTPException(status_code=404, detail="Not found")
    return current_user
