from __future__ import annotations

import asyncio
import re
import time
from collections import OrderedDict
from typing import Any
from urllib.parse import quote

from app.db.mongo import get_db

_CACHE_TTL_SECONDS = 20
_CACHE_MAX_ENTRIES = 256
_CACHE: OrderedDict[str, tuple[float, list[dict[str, Any]]]] = OrderedDict()


def _cache_get(key: str) -> list[dict[str, Any]] | None:
    now = time.monotonic()
    entry = _CACHE.get(key)
    if not entry:
        return None
    expires_at, payload = entry
    if expires_at <= now:
        _CACHE.pop(key, None)
        return None
    _CACHE.move_to_end(key)
    return payload


def _cache_set(key: str, payload: list[dict[str, Any]]) -> None:
    now = time.monotonic()
    _CACHE[key] = (now + _CACHE_TTL_SECONDS, payload)
    _CACHE.move_to_end(key)
    while len(_CACHE) > _CACHE_MAX_ENTRIES:
        _CACHE.popitem(last=False)


def _score_text(query_lower: str, *candidates: str | None) -> int:
    score = 0
    for raw in candidates:
        text = str(raw or "").strip()
        if not text:
            continue
        lower = text.lower()
        if lower == query_lower:
            score = max(score, 120)
        elif lower.startswith(query_lower):
            score = max(score, 95)
        elif query_lower in lower:
            score = max(score, 70)
    return score


async def _search_tags(
    project_id: str,
    regex: re.Pattern[str],
    query_lower: str,
    per_kind_limit: int,
) -> list[dict[str, Any]]:
    db = await get_db()
    pipeline = [
        {
            "$match": {
                "project_id": project_id,
                "tag_name": {"$type": "string", "$ne": "", "$regex": regex},
            }
        },
        {"$sort": {"created_at": -1}},
        {
            "$group": {
                "_id": {"dataset_type": "$dataset_type", "tag_name": "$tag_name"},
                "last_created_at": {"$max": "$created_at"},
            }
        },
        {"$sort": {"last_created_at": -1}},
        {"$limit": per_kind_limit},
    ]
    docs = await db.ingestion_jobs.aggregate(pipeline).to_list(length=per_kind_limit)

    rows: list[dict[str, Any]] = []
    for doc in docs:
        _id = doc.get("_id") or {}
        tag_name = str(_id.get("tag_name") or "").strip()
        dataset_type = str(_id.get("dataset_type") or "others").strip() or "others"
        if not tag_name:
            continue
        rows.append(
            {
                "kind": "tag",
                "id": f"{dataset_type}:{tag_name}",
                "title": tag_name,
                "subtitle": f"Tag · {dataset_type.upper()}",
                "route": (
                    f"/app/projects/{quote(project_id, safe='')}/data"
                    f"?datasetType={quote(dataset_type, safe='')}"
                    f"&tagName={quote(tag_name, safe='')}"
                ),
                "score": 80 + _score_text(query_lower, tag_name, dataset_type),
            }
        )
    return rows


async def _search_files(
    project_id: str,
    regex: re.Pattern[str],
    query_lower: str,
    per_kind_limit: int,
) -> list[dict[str, Any]]:
    db = await get_db()
    query = {
        "project_id": project_id,
        "$or": [
            {"filename": {"$regex": regex}},
            {"sheet_name": {"$regex": regex}},
            {"tag_name": {"$regex": regex}},
        ],
    }
    projection = {
        "filename": 1,
        "sheet_name": 1,
        "tag_name": 1,
        "dataset_type": 1,
        "processed_key": 1,
        "created_at": 1,
    }
    docs = (
        db.ingestion_jobs.find(query, projection)
        .sort("created_at", -1)
        .limit(per_kind_limit)
    )
    docs_list = await docs.to_list(length=per_kind_limit)

    rows: list[dict[str, Any]] = []
    for doc in docs_list:
        job_id = str(doc.get("_id") or "")
        if not job_id:
            continue
        filename = str(doc.get("filename") or "").strip()
        sheet_name = str(doc.get("sheet_name") or "").strip()
        tag_name = str(doc.get("tag_name") or "").strip()
        dataset_type = str(doc.get("dataset_type") or "").strip()

        title = f"{filename} — {sheet_name}" if sheet_name else filename
        subtitle_parts = ["File"]
        if dataset_type:
            subtitle_parts.append(dataset_type.upper())
        if tag_name:
            subtitle_parts.append(tag_name)

        route = (
            f"/processed-preview/{quote(job_id, safe='')}?edit=1"
            if doc.get("processed_key")
            else f"/raw-preview/{quote(job_id, safe='')}"
        )

        rows.append(
            {
                "kind": "file",
                "id": job_id,
                "title": title or "Unnamed file",
                "subtitle": " · ".join(subtitle_parts),
                "route": route,
                "score": 60 + _score_text(query_lower, filename, sheet_name, tag_name),
            }
        )
    return rows


async def _search_visualizations(
    project_id: str,
    regex: re.Pattern[str],
    query_lower: str,
    per_kind_limit: int,
) -> list[dict[str, Any]]:
    db = await get_db()
    query = {
        "project_id": project_id,
        "$or": [
            {"chart_type": {"$regex": regex}},
            {"tag_name": {"$regex": regex}},
            {"dataset_type": {"$regex": regex}},
            {"filename": {"$regex": regex}},
            {"series.label": {"$regex": regex}},
            {"series.y_axis": {"$regex": regex}},
        ],
    }
    projection = {
        "chart_type": 1,
        "dataset_type": 1,
        "tag_name": 1,
        "filename": 1,
        "series": 1,
        "created_at": 1,
    }
    docs = (
        db.visualizations.find(query, projection)
        .sort("created_at", -1)
        .limit(per_kind_limit)
    )
    docs_list = await docs.to_list(length=per_kind_limit)

    rows: list[dict[str, Any]] = []
    for doc in docs_list:
        viz_id = str(doc.get("_id") or "")
        if not viz_id:
            continue
        chart_type = str(doc.get("chart_type") or "visualization").strip()
        dataset_type = str(doc.get("dataset_type") or "").strip()
        tag_name = str(doc.get("tag_name") or "").strip()
        filename = str(doc.get("filename") or "").strip()
        series = doc.get("series") or []
        first_label = ""
        if isinstance(series, list) and series:
            first = series[0] or {}
            first_label = str(first.get("label") or first.get("y_axis") or "").strip()

        title = first_label or filename or f"{chart_type.title()} visualization"
        subtitle_parts = [f"Visualization · {chart_type}"]
        if dataset_type:
            subtitle_parts.append(dataset_type.upper())
        if tag_name:
            subtitle_parts.append(tag_name)

        rows.append(
            {
                "kind": "visualization",
                "id": viz_id,
                "title": title,
                "subtitle": " · ".join(subtitle_parts),
                "route": (
                    f"/app/projects/{quote(project_id, safe='')}/visualisation"
                    f"?vizId={quote(viz_id, safe='')}"
                ),
                "score": 65 + _score_text(query_lower, title, chart_type, dataset_type, tag_name, filename),
            }
        )
    return rows


async def search_project_resources(
    project_id: str,
    query: str,
    limit: int = 25,
) -> list[dict[str, Any]]:
    safe_query = str(query or "").strip()
    if not safe_query:
        return []

    safe_limit = max(1, min(int(limit), 50))
    cache_key = f"{project_id}:{safe_query.lower()}:{safe_limit}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    regex = re.compile(re.escape(safe_query), re.IGNORECASE)
    query_lower = safe_query.lower()
    per_kind_limit = min(max(8, safe_limit), 20)

    tags, files, visualizations = await asyncio.gather(
        _search_tags(project_id, regex, query_lower, per_kind_limit),
        _search_files(project_id, regex, query_lower, per_kind_limit),
        _search_visualizations(project_id, regex, query_lower, per_kind_limit),
    )

    merged = tags + files + visualizations
    merged.sort(key=lambda item: item.get("score", 0), reverse=True)

    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in merged:
        key = f"{item.get('kind')}:{item.get('id')}"
        if key in seen:
            continue
        seen.add(key)
        row = {k: v for k, v in item.items() if k != "score"}
        deduped.append(row)
        if len(deduped) >= safe_limit:
            break

    _cache_set(cache_key, deduped)
    return deduped
