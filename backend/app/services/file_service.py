import logging
import uuid
from pathlib import Path

import aiofiles

from app.config import settings

logger = logging.getLogger(__name__)


def get_upload_root() -> Path:
    return Path(settings.uploads_dir)


def get_resume_path(user_id: uuid.UUID, resume_id: uuid.UUID, ext: str, variant: str = "original") -> str:
    """
    Returns relative path (without /uploads prefix) for a resume file.
    e.g. '{user_id}/resumes/{resume_id}_original.pdf'
    """
    return f"{user_id}/resumes/{resume_id}_{variant}.{ext}"


def get_cover_letter_path(user_id: uuid.UUID, cover_letter_id: uuid.UUID, ext: str) -> str:
    """
    Returns relative path for a cover letter file.
    e.g. '{user_id}/cover_letters/{cover_letter_id}.pdf'
    """
    return f"{user_id}/cover_letters/{cover_letter_id}.{ext}"


def get_absolute_path(relative_path: str) -> Path:
    """Convert a relative path (from DB) to absolute filesystem path."""
    return get_upload_root() / relative_path


async def save_upload(file_contents: bytes, relative_path: str) -> str:
    """
    Save file contents to disk using the relative path.
    Creates parent directories if they don't exist.
    Returns the relative path.
    """
    abs_path = get_absolute_path(relative_path)
    abs_path.parent.mkdir(parents=True, exist_ok=True)

    async with aiofiles.open(abs_path, "wb") as f:
        await f.write(file_contents)

    logger.info(f"File saved: {relative_path} ({len(file_contents)} bytes)")
    return relative_path


async def delete_file(relative_path: str) -> bool:
    """Delete a file by its relative path. Returns True if deleted, False if not found."""
    if not relative_path:
        return False
    abs_path = get_absolute_path(relative_path)
    if abs_path.exists():
        abs_path.unlink()
        logger.info(f"File deleted: {relative_path}")
        return True
    logger.warning(f"File not found for deletion: {relative_path}")
    return False


async def delete_user_files(user_id: uuid.UUID) -> None:
    """Delete all files belonging to a user (called on account deletion)."""
    user_dir = get_upload_root() / str(user_id)
    if user_dir.exists():
        import shutil
        shutil.rmtree(user_dir)
        logger.info(f"Deleted all files for user {user_id}")


def file_exists(relative_path: str) -> bool:
    """Check if a file exists on disk."""
    return get_absolute_path(relative_path).exists()
