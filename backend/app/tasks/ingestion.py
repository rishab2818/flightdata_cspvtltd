import json
import os
import tempfile
from datetime import datetime
from typing import List

import pandas as pd
from bson import ObjectId
from celery import states
from scipy.io import loadmat

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.minio_client import get_minio_client
from app.core.redis_client import get_sync_redis
from app.db.sync_mongo import get_sync_db


def _publish(job_id: str, status: str, progress: int, message: str = ""):
    redis = get_sync_redis()
    payload = json.dumps(
        {"status": status, "progress": progress, "message": message or status}
    )
    redis.publish(f"ingestion:{job_id}:events", payload)
    redis.hset(
        f"ingestion:{job_id}:status",
        mapping={
            "status": status,
            "progress": progress,
            "message": message or status,
        },
    )


def _summarise_dataframe(chunks):
    sample_rows = []
    columns: List[str] = []
    rows_seen = 0
    for chunk in chunks:
        if not columns:
            columns = list(chunk.columns)
        rows_seen += len(chunk)
        if len(sample_rows) < 10:
            sample_rows.extend(chunk.head(10 - len(sample_rows)).to_dict(orient="records"))
        if rows_seen >= 5000:
            break
    return {
        "columns": columns,
        "sample_rows": sample_rows,
        "rows_seen": rows_seen,
    }


def _parse_csv(path: str, delimiter: str = ","):
    chunks = pd.read_csv(path, chunksize=2000, delimiter=delimiter)
    return _summarise_dataframe(chunks)


def _parse_excel(path: str):
    df_iter = pd.read_excel(path, sheet_name=0, chunksize=1000)
    return _summarise_dataframe(df_iter)


def _parse_dat(path: str):
    chunks = pd.read_csv(path, delim_whitespace=True, chunksize=2000, engine="python")
    return _summarise_dataframe(chunks)


def _parse_mat(path: str):
    raw = loadmat(path)
    filtered = {k: v for k, v in raw.items() if not k.startswith("__")}
    rows = []
    columns: List[str] = []
    meta = {}
    for name, arr in filtered.items():
        meta[name] = {"shape": list(arr.shape), "dtype": str(arr.dtype)}
        if arr.ndim == 2 and arr.size > 0:
            columns = [f"{name}_{i}" for i in range(arr.shape[1])]
            for idx in range(min(10, arr.shape[0])):
                rows.append(
                    {
                        f"{name}_{i}": (
                            arr[idx][i].item() if hasattr(arr[idx][i], "item") else arr[idx][i]
                        )
                        for i in range(min(arr.shape[1], 6))
                    }
                )
    return {
        "columns": columns,
        "sample_rows": rows,
        "rows_seen": len(rows),
        "metadata": meta,
    }


@celery_app.task(bind=True, name=f"{settings.celery_task_prefix}.ingest_file")
def ingest_file(self, job_id: str, bucket: str, storage_key: str, filename: str):
    redis = get_sync_redis()
    db = get_sync_db()
    minio = get_minio_client()

    tmp_fd, tmp_path = tempfile.mkstemp()
    os.close(tmp_fd)
    try:
        _publish(job_id, states.STARTED, 5, "Downloading object from MinIO")
        response = minio.get_object(bucket, storage_key)
        with open(tmp_path, "wb") as f:
            for data in response.stream(1 * 1024 * 1024):
                f.write(data)

        _publish(job_id, states.STARTED, 25, "Parsing file")
        db.ingestion_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": states.STARTED, "progress": 25, "updated_at": datetime.utcnow()}},
        )
        ext = os.path.splitext(filename.lower())[-1]
        if ext in [".csv"]:
            summary = _parse_csv(tmp_path)
        elif ext in [".xlsx", ".xlsm", ".xls"]:
            summary = _parse_excel(tmp_path)
        elif ext in [".dat", ".txt"]:
            summary = _parse_dat(tmp_path)
        elif ext in [".mat"]:
            summary = _parse_mat(tmp_path)
        else:
            summary = _parse_csv(tmp_path)

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
                    "updated_at": datetime.utcnow(),
                }
            },
        )
    except Exception as exc:  # noqa: BLE001
        redis.hset(
            f"ingestion:{job_id}:status",
            mapping={"status": states.FAILURE, "progress": 100, "message": str(exc)},
        )
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
        raise
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
