import os
import tempfile
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import pandas as pd

from app.core.config import settings
from app.core.minio_client import get_minio_client
from app.text_formats import RAW_TEXT_EXTENSIONS

EXCEL_EXTENSIONS = {".xlsx", ".xls"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp"}
PDF_EXTENSIONS = {".pdf"}
MAT_EXTENSIONS = {".mat"}

DEFAULT_TEXT_CHUNK_SIZE = 256 * 1024
MAX_TEXT_CHUNK_SIZE = 1024 * 1024
DEFAULT_EXCEL_ROW_LIMIT = 50
MAX_EXCEL_ROW_LIMIT = 200


def get_extension(filename: str | None) -> str:
    value = str(filename or "").strip()
    _, ext = os.path.splitext(value)
    return ext.lower()


def detect_preview_kind(filename: str | None, content_type: str | None = None) -> str:
    ext = get_extension(filename)
    mime = str(content_type or "").lower()

    if ext in RAW_TEXT_EXTENSIONS or mime.startswith("text/"):
        return "text"
    if ext in EXCEL_EXTENSIONS:
        return "excel"
    if ext in MAT_EXTENSIONS:
        return "mat"
    if ext in PDF_EXTENSIONS or mime == "application/pdf":
        return "pdf"
    if ext in IMAGE_EXTENSIONS or mime.startswith("image/"):
        return "image"
    return "download"


def build_download_url(storage_key: str) -> str:
    minio = get_minio_client()
    return minio.presigned_get_object(
        bucket_name=settings.ingestion_bucket,
        object_name=storage_key,
    )


def get_object_size(storage_key: str) -> int:
    minio = get_minio_client()
    stat = minio.stat_object(settings.ingestion_bucket, storage_key)
    return int(getattr(stat, "size", 0) or 0)


def clamp_text_chunk_size(chunk_size: int | None) -> int:
    try:
        size = int(chunk_size or DEFAULT_TEXT_CHUNK_SIZE)
    except (TypeError, ValueError):
        size = DEFAULT_TEXT_CHUNK_SIZE
    return max(32 * 1024, min(size, MAX_TEXT_CHUNK_SIZE))


def clamp_excel_row_limit(row_limit: int | None) -> int:
    try:
        limit = int(row_limit or DEFAULT_EXCEL_ROW_LIMIT)
    except (TypeError, ValueError):
        limit = DEFAULT_EXCEL_ROW_LIMIT
    return max(1, min(limit, MAX_EXCEL_ROW_LIMIT))


def _decode_bytes(raw: bytes) -> str:
    for encoding in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def read_text_chunk(storage_key: str, offset: int = 0, chunk_size: int | None = None, size_bytes: int | None = None) -> dict[str, Any]:
    safe_offset = max(0, int(offset or 0))
    safe_chunk_size = clamp_text_chunk_size(chunk_size)
    total_size = int(size_bytes or 0) or get_object_size(storage_key)
    minio = get_minio_client()
    response = minio.get_object(
        settings.ingestion_bucket,
        storage_key,
        offset=safe_offset,
        length=safe_chunk_size,
    )
    try:
        raw = response.read()
    finally:
        response.close()
        response.release_conn()

    reached_end = not raw or (total_size > 0 and safe_offset + len(raw) >= total_size) or len(raw) < safe_chunk_size
    usable = raw
    next_offset = safe_offset + len(raw)

    if raw and not reached_end:
        last_newline = raw.rfind(b"\n")
        if last_newline > 0:
            usable = raw[: last_newline + 1]
            next_offset = safe_offset + last_newline + 1

    text = _decode_bytes(usable)
    return {
        "offset": safe_offset,
        "next_offset": next_offset,
        "chunk_size": safe_chunk_size,
        "has_more": next_offset < total_size if total_size > 0 else len(raw) == safe_chunk_size,
        "lines": text.splitlines(),
    }


def _json_safe_value(value: Any) -> Any:
    if pd.isna(value):
        return ""
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            return str(value)
    return value


def _download_to_tempfile(storage_key: str, suffix: str) -> str:
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    minio = get_minio_client()
    minio.fget_object(settings.ingestion_bucket, storage_key, path)
    return path


def read_excel_preview(storage_key: str, filename: str, sheet_name: str | None = None, row_limit: int | None = None) -> dict[str, Any]:
    ext = get_extension(filename)
    safe_row_limit = clamp_excel_row_limit(row_limit)
    temp_path = _download_to_tempfile(storage_key, ext or ".xlsx")

    try:
        workbook = pd.ExcelFile(temp_path)
        sheet_names = list(workbook.sheet_names or [])
        if not sheet_names:
            return {
                "active_sheet": "",
                "sheet_names": [],
                "rows": [],
                "row_limit": safe_row_limit,
            }

        active_sheet = sheet_name if sheet_name in sheet_names else sheet_names[0]
        frame = pd.read_excel(
            workbook,
            sheet_name=active_sheet,
            header=None,
            nrows=safe_row_limit,
        )
        rows = [
            [_json_safe_value(value) for value in row]
            for row in frame.fillna("").itertuples(index=False, name=None)
        ]
        return {
            "active_sheet": active_sheet,
            "sheet_names": sheet_names,
            "rows": rows,
            "row_limit": safe_row_limit,
        }
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass
