import asyncio
import json
import os
import tempfile
from datetime import datetime, timedelta
from uuid import uuid4

from bson import ObjectId
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
    Response,
)
from sse_starlette.sse import EventSourceResponse

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.core.minio_client import get_minio_client
from app.core.redis_client import get_async_redis
from app.core.system_info import describe_autoscale
from app.models.ingestion import (
    IngestionCreateResponse,
    IngestionJobOut,
    IngestionStatus,
)
from app.repositories.ingestions import IngestionRepository
from app.repositories.projects import ProjectRepository
from app.tasks.ingestion import ingest_file

router = APIRouter(prefix="/api/ingestion", tags=["ingestion"])
repo = IngestionRepository()
projects = ProjectRepository()


async def _ensure_project_member(project_id: str, user: CurrentUser):
    doc = await projects.get_if_member(project_id, user.email)
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found or no access")
    return doc


@router.post("/{project_id}", response_model=IngestionCreateResponse)
async def start_ingestion(
    project_id: str,
    file: UploadFile = File(...),
    dataset_type: str | None = Form(None),
    header_mode: str = Form("file"),
    custom_headers: str | None = Form(None),
    user: CurrentUser = Depends(get_current_user),
):
    await _ensure_project_member(project_id, user)

    parsed_headers: list[str] | None = None
    if custom_headers:
        try:
            parsed_headers = json.loads(custom_headers)
            if not isinstance(parsed_headers, list) or not all(
                isinstance(item, str) for item in parsed_headers
            ):
                raise ValueError
        except ValueError as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="custom_headers must be a JSON array of strings",
            ) from exc
    if header_mode == "custom" and not parsed_headers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide custom_headers when header_mode is 'custom'",
        )

    header_mode = header_mode or "file"

    valid_header_modes = {"file", "none", "custom"}
    if header_mode not in valid_header_modes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"header_mode must be one of {', '.join(sorted(valid_header_modes))}",
        )

    minio = get_minio_client()
    bucket = settings.ingestion_bucket
    if not minio.bucket_exists(bucket):
        minio.make_bucket(bucket)

    object_key = f"projects/{project_id}/{uuid4()}_{file.filename}"

    # stream upload to temp file then to MinIO to keep memory low
    tmp_fd, tmp_path = tempfile.mkstemp()
    os.close(tmp_fd)
    try:
        with open(tmp_path, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)
        size = os.path.getsize(tmp_path)
        with open(tmp_path, "rb") as data:
            minio.put_object(
                bucket_name=bucket,
                object_name=object_key,
                data=data,
                length=size,
                content_type=file.content_type,
            )
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    job_id = await repo.create_job(
        project_id,
        file.filename,
        object_key,
        user.email,
        dataset_type=dataset_type,
        header_mode=header_mode,
        custom_headers=parsed_headers,
    )
    ingest_file.delay(
        job_id,
        bucket,
        object_key,
        file.filename,
        header_mode,
        parsed_headers,
        dataset_type,
    )

    return IngestionCreateResponse(
        job_id=job_id,
        project_id=project_id,
        filename=file.filename,
        storage_key=object_key,
        dataset_type=dataset_type,
        header_mode=header_mode,
        status="queued",
        autoscale=describe_autoscale(),
    )


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
        except Exception:  # noqa: BLE001
            # if object missing we still remove job record
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
