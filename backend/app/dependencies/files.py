import uuid
from pathlib import Path

from fastapi import HTTPException, status

from app.config import settings
from app.services.file_service import file_exists, get_absolute_path


def verify_file_ownership(relative_path: str, owner_user_id: uuid.UUID) -> None:
    """
    Verify that a file path belongs to the given user.
    Raises 403 if the path doesn't start with the user's directory.
    Raises 404 if the file doesn't exist.
    This prevents path traversal and cross-user access.
    """
    # Normalize path to prevent traversal attacks
    try:
        abs_path = get_absolute_path(relative_path)
        upload_root = Path(settings.uploads_dir).resolve()
        abs_path_resolved = abs_path.resolve()

        # Ensure path is within uploads directory
        abs_path_resolved.relative_to(upload_root)

        # Ensure path starts with user's directory
        user_prefix = str(owner_user_id)
        if not relative_path.startswith(user_prefix + "/"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access to this file is not allowed.",
            )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to this file is not allowed.",
        )

    if not file_exists(relative_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found.",
        )
