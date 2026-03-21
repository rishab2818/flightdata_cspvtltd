from pathlib import Path

from fastapi import HTTPException, status


RESTRICTED_FILE_EXTENSIONS = {
    ".exe",
    ".msi",
    ".bat",
    ".cmd",
    ".com",
    ".scr",
    ".js",
    ".vbs",
    ".ps1",
    ".sh",
    ".py",
    ".php",
    ".html",
    ".htm",
    ".jsp",
    ".asp",
    ".aspx",
}


def get_file_extension(filename: str | None) -> str:
    return Path(str(filename or "").strip()).suffix.lower()


def ensure_allowed_filename(filename: str | None) -> str:
    normalized_name = str(filename or "").strip()
    ext = get_file_extension(normalized_name)
    if ext in RESTRICTED_FILE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Files with the '{ext}' extension are not allowed.",
        )
    return normalized_name
