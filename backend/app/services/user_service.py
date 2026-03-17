import logging
import shutil
from pathlib import Path

from fastapi import Response
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.services.auth_service import clear_auth_cookies

logger = logging.getLogger(__name__)


def delete_user_account(user: User, db: Session, response: Response) -> None:
    """Delete a user account along with all associated data and files.

    Cascade deletes on the User model handle all related DB records
    (jobs, resumes, cover_letters, subscription, usage_logs, notifications).
    File cleanup is performed before the DB delete so that a failed rmtree
    does not leave orphaned rows while still allowing the request to proceed
    if the upload directory simply doesn't exist yet.
    """
    user_id = user.id  # capture before the object is expunged

    # Remove all uploaded files for this user.
    user_upload_dir = Path(settings.uploads_dir) / str(user_id)
    if user_upload_dir.exists():
        shutil.rmtree(user_upload_dir)
        logger.info(f"Removed upload directory for user {user_id}: {user_upload_dir}")

    # Delete the user row — cascade="all, delete-orphan" on every relationship
    # means PostgreSQL (and SQLAlchemy) will remove all related records.
    db.delete(user)
    db.commit()

    # Invalidate the client's JWT cookies so they are logged out immediately.
    clear_auth_cookies(response)

    logger.info(f"User account deleted: {user_id}")
