import json
import os
import re
from datetime import timedelta
from uuid import uuid4
from typing import Dict

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status, Response
from sse_starlette.sse import EventSourceResponse

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.core.minio_client import get_minio_client
from app.core.redis_client import get_async_redis
from app.core.system_info import describe_autoscale
from app.models.ingestion import IngestionBatchCreateResponse, IngestionCreateResponse, IngestionJobOut, IngestionStatus
from app.repositories.ingestions import IngestionRepository
from app.repositories.projects import ProjectRepository
from app.tasks.ingestion import ingest_file
# for the processed data view 
import pyarrow as pa
import pyarrow.parquet as pq
import io
import pandas as pd

router = APIRouter(prefix="/api/ingestion", tags=["ingestion"])
repo = IngestionRepository()
projects = ProjectRepository()

TABULAR_EXTS = {".csv", ".xlsx", ".xls", ".txt", ".dat", ".c"}


def _safe_slug(value: str) -> str:
    value = (value or "").strip()
    value = re.sub(r"[^\w\s\-]", "", value, flags=re.UNICODE)
    value = re.sub(r"\s+", "_", value)
    value = value.replace("__", "_")
    return value or "untitled"


def _dataset_folder(dataset_type: str) -> str:
    # store exactly as per required MinIO structure
    key = (dataset_type or "").lower()
    if key == "cfd":
        return "CFD"
    if key == "wind":
        return "Wind_Data"
    if key == "flight":
        return "Flight_Data"
    return "Unknown"


async def _ensure_project_member(project_id: str, user: CurrentUser):
    doc = await projects.get_if_member(project_id, user.email)
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found or no access")
    return doc


def _parse_custom_headers(custom_headers: str | None, header_mode: str) -> list[str] | None:
    parsed_headers = None
    if custom_headers:
        try:
            parsed_headers = json.loads(custom_headers)
            if not isinstance(parsed_headers, list) or not all(isinstance(x, str) for x in parsed_headers):
                raise ValueError
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="custom_headers must be a JSON array of strings",
            ) from exc

    if header_mode == "custom" and not parsed_headers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide custom_headers when header_mode is 'custom'",
        )
    return parsed_headers


def _normalize_parse_range(value: dict | None) -> dict | None:
    if not value:
        return None
    if not isinstance(value, dict):
        raise HTTPException(status_code=400, detail="parse_range must be an object")
    start = value.get("start_line")
    end = value.get("end_line")
    if not isinstance(start, int) or not isinstance(end, int):
        raise HTTPException(status_code=400, detail="parse_range.start_line/end_line must be integers")
    if start < 1 or end < start:
        raise HTTPException(status_code=400, detail="parse_range must be valid and 1-based")
    return {"start_line": start, "end_line": end}


@router.post("/{project_id}/batch", response_model=IngestionBatchCreateResponse)
async def start_ingestion_batch(
    project_id: str,
    files: list[UploadFile] = File(...),
    dataset_type: str = Form(...),          # cfd/wind/flight
    tag_name: str = Form(...),
    header_mode: str = Form("file"),
    custom_headers: str | None = Form(None),
    manifest: str | None = Form(None),      # JSON list aligned with files order: [{visualize:true/false}]
    user: CurrentUser = Depends(get_current_user),
):
    project = await _ensure_project_member(project_id, user)
    project_name = project.get("project_name") or "Project"
    project_folder = _safe_slug(project_name)

    header_mode = header_mode or "file"
    valid_header_modes = {"file", "none", "custom"}
    if header_mode not in valid_header_modes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"header_mode must be one of {', '.join(sorted(valid_header_modes))}",
        )

    parsed_headers = _parse_custom_headers(custom_headers, header_mode)
    tag_folder = _safe_slug(tag_name)
    dataset_folder = _dataset_folder(dataset_type)

    # manifest parse
    manifest_items = None
    if manifest:
        try:
            manifest_items = json.loads(manifest)
            if not isinstance(manifest_items, list):
                raise ValueError
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="manifest must be a JSON array") from exc

    if manifest_items and len(manifest_items) != len(files):
        raise HTTPException(status_code=400, detail="manifest length must match files length")

    minio = get_minio_client()
    bucket = settings.ingestion_bucket
    if not minio.bucket_exists(bucket):
        minio.make_bucket(bucket)

    batch_id = str(uuid4())
    responses: list[IngestionCreateResponse] = []

    for idx, file in enumerate(files):
        original_name = file.filename or f"file_{idx}"
        ext = os.path.splitext(original_name.lower())[-1]
        requested_visualize = False
        requested_sheets: list[str] = []
        requested_parse_range = None

        if manifest_items:
            item = manifest_items[idx] if idx < len(manifest_items) else None
            if isinstance(item, dict):
                requested_visualize = bool(item.get("visualize", False))
                sheets = item.get("sheets")
                if isinstance(sheets, list):
                    requested_sheets = [s.strip() for s in sheets if isinstance(s, str) and s.strip()]
                requested_parse_range = _normalize_parse_range(item.get("parse_range"))

        # force OFF for non-tabular
        visualize_enabled = bool(requested_visualize and ext in TABULAR_EXTS)
        parse_range_for_job = requested_parse_range if ext in {".dat", ".c"} else None

        raw_key = f"{project_folder}/{dataset_folder}/{tag_folder}/raw/{uuid4()}_{original_name}"

        await file.seek(0)
        minio.put_object(
            bucket_name=bucket,
            object_name=raw_key,
            data=file.file,
            length=-1,
            part_size=10 * 1024 * 1024,
            content_type=file.content_type or "application/octet-stream",
        )
        size_bytes = getattr(file, "size", None)

        excel_exts = {".xlsx", ".xls"}
        all_sheets: list[str] = []
        if ext in excel_exts:
            try:
                await file.seek(0)
                workbook = pd.ExcelFile(file.file)
                all_sheets = [s for s in workbook.sheet_names if isinstance(s, str) and s.strip()]
            except Exception:
                all_sheets = []
        await file.close()

        # Decide which sheets to process for Excel
        sheet_queue: list[str | None]
        if visualize_enabled and ext in excel_exts:
            sheet_queue = requested_sheets or [None]
        else:
            sheet_queue = [None]

        if not visualize_enabled and ext in excel_exts and len(all_sheets) > 1:
            sheet_queue = []

        # Store the full workbook as a raw-only entry for multi-sheet Excel
        if ext in excel_exts and len(all_sheets) > 1:
            full_job_id = await repo.create_job(
                project_id=project_id,
                filename=original_name,
                storage_key=raw_key,
                owner_email=user.email,
                dataset_type=dataset_type,
                header_mode=header_mode,
                custom_headers=parsed_headers,
                tag_name=tag_folder,
                visualize_enabled=False,
                processed_key=None,
                content_type=file.content_type,
                size_bytes=size_bytes,
                sheet_name=None,
                parse_range=None,
            )
            await repo.update_job(full_job_id, status="stored", progress=100)
            responses.append(
                IngestionCreateResponse(
                    job_id=full_job_id,
                    project_id=project_id,
                    filename=original_name,
                    storage_key=raw_key,
                    dataset_type=dataset_type,
                    tag_name=tag_folder,
                    visualize_enabled=False,
                    header_mode=header_mode,
                    status="stored",
                    autoscale=describe_autoscale(),
                    sheet_name=None,
                )
            )

        for sheet_name in sheet_queue:
            processed_key = None
            if visualize_enabled:
                stem = os.path.splitext(original_name)[0]
                if sheet_name:
                    sheet_slug = _safe_slug(sheet_name)
                    processed_key = f"{project_folder}/{dataset_folder}/{tag_folder}/processed/{uuid4()}_{stem}__{sheet_slug}.parquet"
                else:
                    processed_key = f"{project_folder}/{dataset_folder}/{tag_folder}/processed/{uuid4()}_{stem}.parquet"

            job_id = await repo.create_job(
                project_id=project_id,
                filename=original_name,
                storage_key=raw_key,
                owner_email=user.email,
                dataset_type=dataset_type,
                header_mode=header_mode,
                custom_headers=parsed_headers,
                tag_name=tag_folder,
                visualize_enabled=visualize_enabled,
                processed_key=processed_key,
                content_type=file.content_type,
                size_bytes=size_bytes,
                sheet_name=sheet_name,
                parse_range=parse_range_for_job,
            )

            # If visualize enabled, materialize parquet during ingestion
            if visualize_enabled:
                ingest_file.delay(
                    job_id,
                    bucket,
                    raw_key,
                    processed_key,
                    original_name,
                    header_mode,
                    parsed_headers,
                    dataset_type,
                    tag_folder,
                    sheet_name,
                    parse_range_for_job,
                )
                status_value = "queued"
            else:
                # stored raw only
                await repo.update_job(job_id, status="stored", progress=100)
                status_value = "stored"

            responses.append(
                IngestionCreateResponse(
                    job_id=job_id,
                    project_id=project_id,
                    filename=original_name,
                    storage_key=raw_key,
                    dataset_type=dataset_type,
                    tag_name=tag_folder,
                    visualize_enabled=visualize_enabled,
                    header_mode=header_mode,
                    status=status_value,
                    autoscale=describe_autoscale(),
                    sheet_name=sheet_name,
                    parse_range=None,
                )
            )

        # Store raw-only entries for any sheets not selected for visualization
        if ext in excel_exts and all_sheets:
            selected_set = {s for s in sheet_queue if isinstance(s, str)}
            for sheet_name in all_sheets:
                if sheet_name in selected_set:
                    continue
                raw_sheet_job_id = await repo.create_job(
                    project_id=project_id,
                    filename=original_name,
                    storage_key=raw_key,
                    owner_email=user.email,
                    dataset_type=dataset_type,
                    header_mode=header_mode,
                    custom_headers=parsed_headers,
                    tag_name=tag_folder,
                    visualize_enabled=False,
                    processed_key=None,
                    content_type=file.content_type,
                    size_bytes=size_bytes,
                    sheet_name=sheet_name,
                )
                await repo.update_job(raw_sheet_job_id, status="stored", progress=100)
                responses.append(
                    IngestionCreateResponse(
                        job_id=raw_sheet_job_id,
                        project_id=project_id,
                        filename=original_name,
                        storage_key=raw_key,
                        dataset_type=dataset_type,
                        tag_name=tag_folder,
                        visualize_enabled=False,
                        header_mode=header_mode,
                        status="stored",
                        autoscale=describe_autoscale(),
                        sheet_name=sheet_name,
                    )
                )

    return IngestionBatchCreateResponse(
        batch_id=batch_id,
        project_id=project_id,
        dataset_type=dataset_type,
        tag_name=tag_folder,
        jobs=responses,
    )


# --- Existing endpoints kept as-is below (job detail/status/download/list/stream/delete) ---

@router.get("/jobs/{job_id}", response_model=IngestionJobOut)
async def get_job(job_id: str, user: CurrentUser = Depends(get_current_user)):
    doc = await repo.get_job(job_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found")
    await _ensure_project_member(doc["project_id"], user)
    return IngestionJobOut(**doc)


@router.get("/jobs/{job_id}/download")
async def get_download_url(job_id: str, user: CurrentUser = Depends(get_current_user)):
    doc = await repo.get_job(job_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found")
    await _ensure_project_member(doc["project_id"], user)
    minio = get_minio_client()
    bucket = settings.ingestion_bucket
    if not minio.bucket_exists(bucket):
        raise HTTPException(status_code=404, detail="Object bucket missing")
    url = minio.presigned_get_object(
        bucket_name=bucket,
        object_name=doc["storage_key"],
        expires=timedelta(hours=1),
    )
    return {"url": url}


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(job_id: str, user: CurrentUser = Depends(get_current_user)):
    doc = await repo.get_job(job_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found")
    await _ensure_project_member(doc["project_id"], user)

    minio = get_minio_client()
    bucket = settings.ingestion_bucket
    if minio.bucket_exists(bucket):
        try:
            minio.remove_object(bucket_name=bucket, object_name=doc["storage_key"])
            if doc.get("processed_key"):
                minio.remove_object(bucket_name=bucket, object_name=doc["processed_key"])
        except Exception:
            pass
    await repo.delete_job(job_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/project/{project_id}", response_model=list[IngestionJobOut])
async def list_jobs(project_id: str, user: CurrentUser = Depends(get_current_user)):
    await _ensure_project_member(project_id, user)
    docs = await repo.list_for_project(project_id)
    return [IngestionJobOut(**d) for d in docs]


async def event_generator(job_id: str):
    redis = get_async_redis()
    pubsub = redis.pubsub()
    channel_name = f"ingestion:{job_id}:events"
    await pubsub.subscribe(channel_name)
    try:
        async for message in pubsub.listen():
            if message.get("type") != "message":
                continue
            yield {"event": "progress", "data": message.get("data")}
    finally:
        await pubsub.unsubscribe(channel_name)
        await pubsub.close()


@router.get("/jobs/{job_id}/stream")
async def stream_progress(job_id: str, user: CurrentUser = Depends(get_current_user)):
    doc = await repo.get_job(job_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found")
    await _ensure_project_member(doc["project_id"], user)
    return EventSourceResponse(event_generator(job_id))


@router.get("/jobs/{job_id}/status", response_model=IngestionStatus)
async def job_status(job_id: str, user: CurrentUser = Depends(get_current_user)):
    doc = await repo.get_job(job_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found")
    await _ensure_project_member(doc["project_id"], user)
    redis = get_async_redis()
    mapping = await redis.hgetall(f"ingestion:{job_id}:status")
    if not mapping:
        return IngestionStatus(status=doc.get("status", "queued"), progress=doc.get("progress", 0))
    return IngestionStatus(
        status=mapping.get("status", "queued"),
        progress=int(mapping.get("progress", 0)),
        message=mapping.get("message"),
    )


# for the fetching the data from the tag list 
from fastapi import Query
from app.db.mongo import get_db

@router.get("/project/{project_id}/tags")
async def list_tags(
    project_id: str,
    dataset_type: str = Query(...),
    user: CurrentUser = Depends(get_current_user),
):
    await _ensure_project_member(project_id, user)
    db = await get_db()

    pipeline = [
        {"$match": {"project_id": project_id, "dataset_type": dataset_type}},
        {"$group": {
            "_id": {"tag_name": "$tag_name"},
            "tag_name": {"$first": "$tag_name"},
            "latest_created_at": {"$max": "$created_at"},
            "file_count": {"$sum": 1},
            "visualize_count": {"$sum": {"$cond": ["$visualize_enabled", 1, 0]}},
        }},
        {"$sort": {"latest_created_at": -1}},
    ]

    rows = await db["ingestion_jobs"].aggregate(pipeline).to_list(length=500)
    # clean mongo types
    for r in rows:
        r.pop("_id", None)
        if r.get("latest_created_at"):
            r["latest_created_at"] = r["latest_created_at"].isoformat()
    return rows



@router.get("/project/{project_id}/tag/{tag_name}")
async def list_files_in_tag(
    project_id: str,
    tag_name: str,
    dataset_type: str = Query(...),
    user: CurrentUser = Depends(get_current_user),
):
    await _ensure_project_member(project_id, user)

    docs = await repo.list_for_project(project_id)

    rows = [
        d for d in docs
        if d.get("dataset_type") == dataset_type
        and d.get("tag_name") == tag_name
    ]

    return rows


# for the edit 
from pydantic import BaseModel

class TagRenameIn(BaseModel):
    dataset_type: str
    old_tag: str
    new_tag: str

@router.put("/project/{project_id}/tag/rename")
async def rename_tag(
    project_id: str,
    payload: TagRenameIn,
    user: CurrentUser = Depends(get_current_user),
):
    await _ensure_project_member(project_id, user)

    old_tag = payload.old_tag.strip()
    new_tag = payload.new_tag.strip()
    if not old_tag or not new_tag:
        raise HTTPException(status_code=400, detail="old_tag and new_tag are required")

    db = repo.db  # or however you access mongo in your repo
    # DB ONLY: update tag_name field
    res = await db["ingestion_jobs"].update_many(
        {"project_id": project_id, "dataset_type": payload.dataset_type, "tag_name": old_tag},
        {"$set": {"tag_name": new_tag}},
    )
    return {"updated": res.modified_count}


# for preview of the processed data 
# Load parquet form minio (Helper function)
def _read_parquet_from_minio(bucket: str, object_key: str):
    minio = get_minio_client()
    resp = minio.get_object(bucket, object_key)
    try:
        data = resp.read()  # OK for preview sizes; if you expect huge parquet, we can stream
    finally:
        resp.close()
        resp.release_conn()

    buf = io.BytesIO(data)
    return pq.read_table(buf)  # pyarrow Table

#Preview JSON (all columns, limited rows)
@router.get("/jobs/{job_id}/processed/preview")
async def preview_processed(
    job_id: str,
    limit: int = Query(20, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
):
    doc = await repo.get_job(job_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found")
    await _ensure_project_member(doc["project_id"], user)

    processed_key = doc.get("processed_key")
    if not processed_key:
        raise HTTPException(status_code=400, detail="No processed parquet available for this file")

    bucket = settings.ingestion_bucket

    # Read parquet and keep only a small number of rows
    table = _read_parquet_from_minio(bucket, processed_key)
    original_cols = table.schema.names

    # ensure we have stored schema once (optional but useful)
    # (safe even if called multiple times)
    try:
        await repo.update_job_fields(job_id, {"processed_schema": original_cols})
    except Exception:
        pass

    rename_map: Dict[str, str] = doc.get("column_rename_map") or {}
    display_cols = [rename_map.get(c, c) for c in original_cols]

    # Slice rows
    sliced = table.slice(0, limit)

    # Convert to list-of-dicts using display column names
    # This keeps UI simple.
    cols_as_py = {display_cols[i]: sliced.column(i).to_pylist() for i in range(sliced.num_columns)}
    rows = []
    for r in range(sliced.num_rows):
        rows.append({col: cols_as_py[col][r] for col in display_cols})

    return {
        "job_id": job_id,
        "filename": doc.get("filename"),
        "original_columns": original_cols,
        "rename_map": rename_map,
        "display_columns": display_cols,
        "rows": rows,
        "limit": limit,
        "total_rows": table.num_rows,
    }

# End B : Save rename map (per file)

class RenameColumnsIn(BaseModel):
    rename_map: Dict[str, str]

@router.put("/jobs/{job_id}/processed/columns")
async def save_processed_column_names(
    job_id: str,
    payload: RenameColumnsIn,
    user: CurrentUser = Depends(get_current_user),
):
    doc = await repo.get_job(job_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found")
    await _ensure_project_member(doc["project_id"], user)

    processed_key = doc.get("processed_key")
    if not processed_key:
        raise HTTPException(status_code=400, detail="No processed parquet available for this file")

    # get original schema (from DB if present, else read parquet once)
    original_cols = doc.get("processed_schema")
    if not original_cols:
        table = _read_parquet_from_minio(settings.ingestion_bucket, processed_key)
        original_cols = table.schema.names

    rename_map = payload.rename_map or {}

    # validate keys exist + new names non-empty
    for k, v in rename_map.items():
        if k not in original_cols:
            raise HTTPException(status_code=400, detail=f"Unknown column in rename_map: {k}")
        if not isinstance(v, str) or not v.strip():
            raise HTTPException(status_code=400, detail=f"Empty display name for column: {k}")

    # validate duplicates after rename
    display_cols = [rename_map.get(c, c).strip() for c in original_cols]
    if len(set(display_cols)) != len(display_cols):
        raise HTTPException(status_code=400, detail="Duplicate column names after rename")

    await repo.update_job_fields(job_id, {
        "processed_schema": original_cols,
        "column_rename_map": {k: v.strip() for k, v in rename_map.items()},
    })

    return {"ok": True}


