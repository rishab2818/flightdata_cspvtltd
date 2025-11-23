import os
from datetime import timedelta
from typing import Any

from app.core.config import settings
from app.core.minio_client import get_minio_client
from app.tasks.visualization import _iter_chunks


def _normalize_ext(filename: str) -> str:
    ext = os.path.splitext((filename or "").lower())[-1]
    return ext or ".csv"


def slice_points_by_range(
    url: str,
    ext: str,
    x_axis: str,
    y_axis: str,
    start: float,
    end: float,
    offset: int = 0,
    limit: int = 1000,
) -> tuple[list[dict[str, Any]], int]:
    """Filter rows within the requested x-range and paginate the results.

    The function scans the entire dataset to compute the total number of rows
    matching the window so the caller can detect when no more tiles remain.
    Only the requested slice is retained in memory.
    """

    if start >= end:
        raise ValueError("start must be less than end")
    if offset < 0:
        raise ValueError("offset must be non-negative")
    if limit <= 0:
        raise ValueError("limit must be positive")

    collected: list[dict[str, Any]] = []
    total_in_window = 0

    for chunk in _iter_chunks(url, ext, x_axis, y_axis):
        if chunk is None or chunk.empty:
            continue

        filtered = chunk.dropna(subset=[x_axis, y_axis])
        filtered = filtered[(filtered[x_axis] >= start) & (filtered[x_axis] <= end)]
        if filtered.empty:
            continue

        window_len = len(filtered)
        next_total = total_in_window + window_len

        if next_total <= offset:
            total_in_window = next_total
            continue

        slice_start = max(0, offset - total_in_window)
        rows_needed = max(0, limit - len(collected))
        if rows_needed > 0:
            take = filtered.iloc[slice_start : slice_start + rows_needed]
            collected.extend(take.to_dict(orient="records"))

        total_in_window = next_total

    return collected, total_in_window


def fetch_data_window(
    storage_key: str,
    filename: str,
    x_axis: str,
    y_axis: str,
    start: float,
    end: float,
    offset: int = 0,
    limit: int = 1000,
) -> dict[str, Any]:
    """Load a paginated window of points for the provided axes."""

    minio = get_minio_client()
    url = minio.presigned_get_object(
        bucket_name=settings.ingestion_bucket,
        object_name=storage_key,
        expires=timedelta(hours=2),
    )
    ext = _normalize_ext(filename)

    rows, total_in_window = slice_points_by_range(
        url, ext, x_axis, y_axis, start, end, offset=offset, limit=limit
    )

    return {
        "rows": rows,
        "total_in_window": total_in_window,
        "offset": offset,
        "limit": limit,
        "start": start,
        "end": end,
        "has_more": total_in_window > offset + len(rows),
    }
