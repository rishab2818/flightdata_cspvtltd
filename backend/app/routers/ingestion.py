import asyncio
import json
import os
import tempfile
from datetime import datetime
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
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
    user: CurrentUser = Depends(get_current_user),
):
    await _ensure_project_member(project_id, user)

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

    job_id = await repo.create_job(project_id, file.filename, object_key, user.email)
    ingest_file.delay(job_id, bucket, object_key, file.filename)

    return IngestionCreateResponse(
        job_id=job_id,
        project_id=project_id,
        filename=file.filename,
        storage_key=object_key,
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
