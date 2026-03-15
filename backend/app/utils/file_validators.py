import mimetypes
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, UploadFile, status

ALLOWED_CONTENT_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}

ALLOWED_EXTENSIONS = {".pdf", ".docx"}

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB


def get_file_extension(filename: str) -> Optional[str]:
    """Extract and normalize file extension."""
    if not filename:
        return None
    suffix = Path(filename).suffix.lower()
    return suffix if suffix in ALLOWED_EXTENSIONS else None


async def validate_upload_file(file: UploadFile, max_size_mb: int = 10) -> str:
    """
    Validate file format and size.
    Returns the file extension ('pdf' or 'docx') on success.
    Raises HTTPException on validation failure.
    """
    max_bytes = max_size_mb * 1024 * 1024

    # Validate extension
    ext = get_file_extension(file.filename or "")
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported file format. Only PDF and DOCX are allowed.",
        )

    # Validate content type
    content_type = file.content_type or ""
    # Strip parameters from content type (e.g., "application/pdf; charset=utf-8")
    content_type_base = content_type.split(";")[0].strip()
    if content_type_base and content_type_base not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported content type '{content_type_base}'. Only PDF and DOCX are allowed.",
        )

    # Read and validate size
    contents = await file.read()
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds the {max_size_mb}MB limit.",
        )

    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File is empty.",
        )

    # Seek back to beginning so caller can read again
    await file.seek(0)

    return ext.lstrip(".")
