import json
import os
import tempfile
from datetime import datetime
from typing import List

from bson import ObjectId
from celery import states

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.minio_client import get_minio_client
from app.core.redis_client import get_sync_redis
from app.core.rust_bridge import RustNotInstalled, summarize_file
from app.db.sync_mongo import get_sync_db
from app.repositories.notifications import create_sync_notification


def _set_status(redis, job_id: str, status: str, progress: int, message: str):
    """Persist the job status in Redis.

    Redis servers older than 4.0 do not support setting multiple fields with a
    single HSET call, so we update each field individually via a pipeline for
    compatibility.
    """

    pipe = redis.pipeline()
    name = f"ingestion:{job_id}:status"
    pipe.hset(name, "status", status)
    pipe.hset(name, "progress", progress)
    pipe.hset(name, "message", message)
    pipe.execute()


def _publish(job_id: str, status: str, progress: int, message: str = ""):
    redis = get_sync_redis()
    payload = json.dumps(
        {"status": status, "progress": progress, "message": message or status}
    )
    redis.publish(f"ingestion:{job_id}:events", payload)
    _set_status(redis, job_id, status, progress, message or status)


@celery_app.task(bind=True, name=f"{settings.celery_task_prefix}.ingest_file")
def ingest_file(
    self,
    job_id: str,
    bucket: str,
    storage_key: str,
    filename: str,
    header_mode: str = "file",
    custom_headers: list[str] | None = None,
    dataset_type: str | None = None,
):
    redis = get_sync_redis()
    db = get_sync_db()
    minio = get_minio_client()
    job_doc = db.ingestion_jobs.find_one({"_id": ObjectId(job_id)}) or {}
    owner_email = job_doc.get("owner_email")
    project_id = job_doc.get("project_id")
    filename = job_doc.get("filename", filename)

    tmp_fd, tmp_path = tempfile.mkstemp()
    os.close(tmp_fd)
    try:
        _publish(job_id, states.STARTED, 5, "Downloading object from MinIO")
        response = minio.get_object(bucket, storage_key)
        ext = os.path.splitext(filename.lower())[-1]
        preview_exts = {".csv", ".txt", ".dat"}
        max_header_bytes = 1 * 1024 * 1024
        bytes_written = 0

        try:
            with open(tmp_path, "wb") as f:
                for data in response.stream(256 * 1024):
                    if ext in preview_exts:
                        newline_index = data.find(b"\n")
                        if newline_index != -1:
                            f.write(data[: newline_index + 1])
                            break
                        f.write(data)
                        bytes_written += len(data)
                        if bytes_written >= max_header_bytes:
                            break
                        continue
                    f.write(data)
        finally:
            try:
                response.close()
            except Exception:  # noqa: BLE001
                pass
            try:
                response.release_conn()
            except Exception:  # noqa: BLE001
                pass

        _publish(job_id, states.STARTED, 25, "Parsing file")
        db.ingestion_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": states.STARTED, "progress": 25, "updated_at": datetime.utcnow()}},
        )
        file_type = "csv"
        delimiter = ","
        if ext in [".xlsx", ".xlsm", ".xls"]:
            file_type = "excel"
        elif ext in [".dat", ".txt"]:
            file_type = "txt"
            delimiter = " "
        elif ext in [".mat"]:
            file_type = "mat"

        try:
            summary = summarize_file(
                tmp_path,
                file_type=file_type,
                header_mode=header_mode,
                custom_headers=custom_headers,
                delimiter=delimiter,
            )
        except RustNotInstalled:
            raise

        _publish(job_id, states.SUCCESS, 100, "Ingestion finished")
        db.ingestion_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {
                "$set": {
                    "status": states.SUCCESS,
                    "progress": 100,
                    "sample_rows": summary.get("sample_rows"),
                    "columns": summary.get("columns"),
                    "rows_seen": summary.get("rows_seen"),
                    "metadata": summary.get("metadata"),
                    "dataset_type": dataset_type,
                    "header_mode": header_mode,
                    "custom_headers": custom_headers,
                    "updated_at": datetime.utcnow(),
                }
            },
        )
        if owner_email:
            create_sync_notification(
                owner_email,
                f"File ingestion completed for {filename}",
                title="Upload complete",
                category="ingestion",
                link=f"/app/projects/{project_id}/data" if project_id else None,
            )
    except Exception as exc:  # noqa: BLE001
        _set_status(redis, job_id, states.FAILURE, 100, str(exc))
        redis.publish(
            f"ingestion:{job_id}:events",
            json.dumps(
                {"status": states.FAILURE, "progress": 100, "message": str(exc)}
            ),
        )
        db.ingestion_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {
                "$set": {
                    "status": states.FAILURE,
                    "progress": 100,
                    "message": str(exc),
                    "updated_at": datetime.utcnow(),
                }
            },
        )
        if owner_email:
            create_sync_notification(
                owner_email,
                f"File ingestion failed for {filename}",
                title="Upload failed",
                category="ingestion",
                link=f"/app/projects/{project_id}/upload" if project_id else None,
            )
        raise
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
