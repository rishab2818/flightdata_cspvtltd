# import json
# import os
# import tempfile
# from datetime import datetime
# from typing import List

# import pandas as pd
# from bson import ObjectId
# from celery import states
# from scipy.io import loadmat

# from app.core.celery_app import celery_app
# from app.core.config import settings
# from app.core.minio_client import get_minio_client
# from app.core.redis_client import get_sync_redis
# from app.db.sync_mongo import get_sync_db
# from app.repositories.notifications import create_sync_notification


# def _set_status(redis, job_id: str, status: str, progress: int, message: str):
#     """Persist the job status in Redis.

#     Redis servers older than 4.0 do not support setting multiple fields with a
#     single HSET call, so we update each field individually via a pipeline for
#     compatibility.
#     """

#     pipe = redis.pipeline()
#     name = f"ingestion:{job_id}:status"
#     pipe.hset(name, "status", status)
#     pipe.hset(name, "progress", progress)
#     pipe.hset(name, "message", message)
#     pipe.execute()


# def _publish(job_id: str, status: str, progress: int, message: str = ""):
#     redis = get_sync_redis()
#     payload = json.dumps(
#         {"status": status, "progress": progress, "message": message or status}
#     )
#     redis.publish(f"ingestion:{job_id}:events", payload)
#     _set_status(redis, job_id, status, progress, message or status)


# def _summarise_dataframe(
#     chunks, provided_headers=None, header_mode: str = "file", *, header_only: bool = True
# ):
#     """Summarise columns without scanning the whole file.

#     Only the first available chunk/frame is inspected so we can return headers
#     almost immediately. This avoids spending time parsing thousands of rows
#     when callers only need the column list for chart selection.
#     """

#     columns: List[str] = []
#     rows_seen = 0
#     sample_rows: list[dict] = []
#     for chunk in chunks:
#         if header_mode == "none" and not provided_headers:
#             chunk.columns = [f"column_{i+1}" for i in range(len(chunk.columns))]
#         elif provided_headers:
#             if len(provided_headers) != len(chunk.columns):
#                 raise ValueError(
#                     "Number of custom headers does not match detected columns"
#                 )
#             chunk.columns = provided_headers
#         if not columns:
#             columns = list(chunk.columns)
#         if not header_only and not sample_rows:
#             sample_rows = chunk.head(5).to_dict(orient="records")
#         rows_seen += len(chunk)
#         break
#     return {
#         "columns": columns,
#         "sample_rows": sample_rows,
#         "rows_seen": rows_seen,
#     }


# def _parse_csv(
#     path: str,
#     header_mode: str = "file",
#     custom_headers: list[str] | None = None,
#     delimiter: str = ",",
# ):
#     read_kwargs = {"delimiter": delimiter}
#     if header_mode == "none":
#         read_kwargs["header"] = None
#         df_iter = [pd.read_csv(path, nrows=1, **read_kwargs)]
#     elif header_mode == "custom":
#         read_kwargs["header"] = None
#         df_iter = [pd.read_csv(path, nrows=1, **read_kwargs)]
#     else:
#         read_kwargs["header"] = 0
#         df_iter = [pd.read_csv(path, nrows=0, **read_kwargs)]

#     return _summarise_dataframe(df_iter, custom_headers, header_mode)


# def _parse_excel(
#     path: str, header_mode: str = "file", custom_headers: list[str] | None = None
# ):
#     read_kwargs = {"sheet_name": 0}
#     if header_mode == "none":
#         read_kwargs["header"] = None
#         df_iter = [pd.read_excel(path, nrows=1, **read_kwargs)]
#     elif header_mode == "custom":
#         read_kwargs["header"] = None
#         df_iter = [pd.read_excel(path, nrows=1, **read_kwargs)]
#     else:
#         read_kwargs["header"] = 0
#         df_iter = [pd.read_excel(path, nrows=0, **read_kwargs)]
#     return _summarise_dataframe(df_iter, custom_headers, header_mode)


# def _parse_dat(
#     path: str, header_mode: str = "file", custom_headers: list[str] | None = None
# ):
#     read_kwargs = {"delim_whitespace": True, "engine": "python"}
#     if header_mode == "none":
#         read_kwargs["header"] = None
#         df_iter = [pd.read_csv(path, nrows=1, **read_kwargs)]
#     elif header_mode == "custom":
#         read_kwargs["header"] = None
#         df_iter = [pd.read_csv(path, nrows=1, **read_kwargs)]
#     else:
#         read_kwargs["header"] = 0
#         df_iter = [pd.read_csv(path, nrows=0, **read_kwargs)]
#     return _summarise_dataframe(df_iter, custom_headers, header_mode)


# def _parse_mat(path: str):
#     raw = loadmat(path)
#     filtered = {k: v for k, v in raw.items() if not k.startswith("__")}
#     rows = []
#     columns: List[str] = []
#     meta = {}
#     for name, arr in filtered.items():
#         meta[name] = {"shape": list(arr.shape), "dtype": str(arr.dtype)}
#         if arr.ndim == 2 and arr.size > 0:
#             columns = [f"{name}_{i}" for i in range(arr.shape[1])]
#             for idx in range(min(10, arr.shape[0])):
#                 rows.append(
#                     {
#                         f"{name}_{i}": (
#                             arr[idx][i].item() if hasattr(arr[idx][i], "item") else arr[idx][i]
#                         )
#                         for i in range(min(arr.shape[1], 6))
#                     }
#                 )
#     return {
#         "columns": columns,
#         "sample_rows": rows,
#         "rows_seen": len(rows),
#         "metadata": meta,
#     }


# @celery_app.task(bind=True, name=f"{settings.celery_task_prefix}.ingest_file")
# def ingest_file(
#     self,
#     job_id: str,
#     bucket: str,
#     storage_key: str,
#     filename: str,
#     header_mode: str = "file",
#     custom_headers: list[str] | None = None,
#     dataset_type: str | None = None,
# ):
#     redis = get_sync_redis()
#     db = get_sync_db()
#     minio = get_minio_client()
#     job_doc = db.ingestion_jobs.find_one({"_id": ObjectId(job_id)}) or {}
#     owner_email = job_doc.get("owner_email")
#     project_id = job_doc.get("project_id")
#     filename = job_doc.get("filename", filename)

#     tmp_fd, tmp_path = tempfile.mkstemp()
#     os.close(tmp_fd)
#     try:
#         _publish(job_id, states.STARTED, 5, "Downloading object from MinIO")
#         response = minio.get_object(bucket, storage_key)
#         ext = os.path.splitext(filename.lower())[-1]
#         preview_exts = {".csv", ".txt", ".dat"}
#         max_header_bytes = 1 * 1024 * 1024
#         bytes_written = 0

#         try:
#             with open(tmp_path, "wb") as f:
#                 for data in response.stream(256 * 1024):
#                     if ext in preview_exts:
#                         newline_index = data.find(b"\n")
#                         if newline_index != -1:
#                             f.write(data[: newline_index + 1])
#                             break
#                         f.write(data)
#                         bytes_written += len(data)
#                         if bytes_written >= max_header_bytes:
#                             break
#                         continue
#                     f.write(data)
#         finally:
#             try:
#                 response.close()
#             except Exception:  # noqa: BLE001
#                 pass
#             try:
#                 response.release_conn()
#             except Exception:  # noqa: BLE001
#                 pass

#         _publish(job_id, states.STARTED, 25, "Parsing file")
#         db.ingestion_jobs.update_one(
#             {"_id": ObjectId(job_id)},
#             {"$set": {"status": states.STARTED, "progress": 25, "updated_at": datetime.utcnow()}},
#         )
#         if ext in [".csv"]:
#             summary = _parse_csv(
#                 tmp_path, header_mode=header_mode, custom_headers=custom_headers
#             )
#         elif ext in [".xlsx", ".xlsm", ".xls"]:
#             summary = _parse_excel(
#                 tmp_path, header_mode=header_mode, custom_headers=custom_headers
#             )
#         elif ext in [".dat", ".txt"]:
#             summary = _parse_dat(
#                 tmp_path, header_mode=header_mode, custom_headers=custom_headers
#             )
#         elif ext in [".mat"]:
#             summary = _parse_mat(tmp_path)
#         else:
#             summary = _parse_csv(
#                 tmp_path, header_mode=header_mode, custom_headers=custom_headers
#             )

#         _publish(job_id, states.SUCCESS, 100, "Ingestion finished")
#         db.ingestion_jobs.update_one(
#             {"_id": ObjectId(job_id)},
#             {
#                 "$set": {
#                     "status": states.SUCCESS,
#                     "progress": 100,
#                     "sample_rows": summary.get("sample_rows"),
#                     "columns": summary.get("columns"),
#                     "rows_seen": summary.get("rows_seen"),
#                     "metadata": summary.get("metadata"),
#                     "dataset_type": dataset_type,
#                     "header_mode": header_mode,
#                     "custom_headers": custom_headers,
#                     "updated_at": datetime.utcnow(),
#                 }
#             },
#         )
#         if owner_email:
#             create_sync_notification(
#                 owner_email,
#                 f"File ingestion completed for {filename}",
#                 title="Upload complete",
#                 category="ingestion",
#                 link=f"/app/projects/{project_id}/data" if project_id else None,
#             )
#     except Exception as exc:  # noqa: BLE001
#         _set_status(redis, job_id, states.FAILURE, 100, str(exc))
#         redis.publish(
#             f"ingestion:{job_id}:events",
#             json.dumps(
#                 {"status": states.FAILURE, "progress": 100, "message": str(exc)}
#             ),
#         )
#         db.ingestion_jobs.update_one(
#             {"_id": ObjectId(job_id)},
#             {
#                 "$set": {
#                     "status": states.FAILURE,
#                     "progress": 100,
#                     "message": str(exc),
#                     "updated_at": datetime.utcnow(),
#                 }
#             },
#         )
#         if owner_email:
#             create_sync_notification(
#                 owner_email,
#                 f"File ingestion failed for {filename}",
#                 title="Upload failed",
#                 category="ingestion",
#                 link=f"/app/projects/{project_id}/upload" if project_id else None,
#             )
#         raise
#     finally:
#         if os.path.exists(tmp_path):
#             os.remove(tmp_path)

import json
import os
import tempfile
from datetime import datetime

import pandas as pd
from bson import ObjectId
from celery import states

try:
    import pyarrow as pa
    import pyarrow.parquet as pq
except Exception:  # noqa
    pa = None
    pq = None

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.minio_client import get_minio_client
from app.core.redis_client import get_sync_redis
from app.db.sync_mongo import get_sync_db
from app.repositories.notifications import create_sync_notification


TABULAR_EXTS = {".csv", ".xlsx", ".xls"}


def _set_status(redis, job_id: str, status: str, progress: int, message: str):
    pipe = redis.pipeline()
    name = f"ingestion:{job_id}:status"
    pipe.hset(name, "status", status)
    pipe.hset(name, "progress", progress)
    pipe.hset(name, "message", message)
    pipe.execute()


def _publish(job_id: str, status: str, progress: int, message: str = ""):
    redis = get_sync_redis()
    payload = json.dumps({"status": status, "progress": progress, "message": message or status})
    redis.publish(f"ingestion:{job_id}:events", payload)
    _set_status(redis, job_id, status, progress, message or status)


def _clean_excel_df(df: pd.DataFrame) -> pd.DataFrame:
    # Drop fully empty columns and "Unnamed" headers (common in Excel).
    df = df.copy()
    # remove columns whose name is empty/unnamed and that are fully null
    drop_cols = []
    for c in df.columns:
        name = str(c).strip()
        if name == "" or name.lower().startswith("unnamed"):
            if df[c].isna().all() or (df[c].astype(str).str.strip() == "").all():
                drop_cols.append(c)
    if drop_cols:
        df = df.drop(columns=drop_cols, errors="ignore")
    # also drop columns that are entirely empty
    df = df.dropna(axis=1, how="all")
    return df


def _apply_header_mode(df: pd.DataFrame, header_mode: str, custom_headers: list[str] | None):
    if header_mode == "none" and not custom_headers:
        df.columns = [f"column_{i+1}" for i in range(len(df.columns))]
    elif header_mode == "custom":
        if not custom_headers:
            raise ValueError("custom_headers required when header_mode=custom")
        if len(custom_headers) != len(df.columns):
            raise ValueError("Number of custom headers does not match detected columns")
        df.columns = custom_headers
    return df


def _update_numeric_stats(stats: dict, df: pd.DataFrame):
    # stats[col] = {min, max}
    for col in df.columns:
        s = pd.to_numeric(df[col], errors="coerce")
        if s.notna().any():
            mn = float(s.min())
            mx = float(s.max())
            if col not in stats:
                stats[col] = {"min": mn, "max": mx}
            else:
                stats[col]["min"] = min(stats[col]["min"], mn)
                stats[col]["max"] = max(stats[col]["max"], mx)


def _csv_to_parquet(csv_path: str, parquet_path: str, header_mode: str, custom_headers: list[str] | None):
    # Use chunking to avoid loading the whole file
    read_kwargs = {}
    if header_mode in ("none", "custom"):
        read_kwargs["header"] = None
    else:
        read_kwargs["header"] = 0

    chunks = pd.read_csv(csv_path, chunksize=200_000, **read_kwargs)

    writer = None
    stats = {}
    columns = None
    rows = 0
    sample_rows = None

    for i, chunk in enumerate(chunks):
        chunk = _apply_header_mode(chunk, header_mode, custom_headers)
        if columns is None:
            columns = list(chunk.columns)
            sample_rows = chunk.head(10).to_dict(orient="records")

        _update_numeric_stats(stats, chunk)
        rows += len(chunk)

        if pa and pq:
            table = pa.Table.from_pandas(chunk, preserve_index=False)
            if writer is None:
                writer = pq.ParquetWriter(parquet_path, table.schema, compression="snappy")
            writer.write_table(table)
        else:
            # fallback (less efficient): write once at end
            # NOTE: if pyarrow missing, this will be memory heavy for big files.
            pass

    if writer:
        writer.close()
    else:
        # fallback path: re-read fully (only OK for small files)
        df = pd.read_csv(csv_path, **read_kwargs)
        df = _apply_header_mode(df, header_mode, custom_headers)
        _update_numeric_stats(stats, df)
        rows = len(df)
        sample_rows = df.head(10).to_dict(orient="records")
        df.to_parquet(parquet_path, index=False)

    return columns or [], rows, sample_rows or [], stats


def _excel_to_parquet(xls_path: str, parquet_path: str, header_mode: str, custom_headers: list[str] | None):
    # Always first sheet
    read_kwargs = {"sheet_name": 0}
    if header_mode in ("none", "custom"):
        read_kwargs["header"] = None
    else:
        read_kwargs["header"] = 0

    df = pd.read_excel(xls_path, **read_kwargs)
    df = _clean_excel_df(df)
    df = _apply_header_mode(df, header_mode, custom_headers)

    stats = {}
    _update_numeric_stats(stats, df)
    columns = list(df.columns)
    rows = len(df)
    sample_rows = df.head(10).to_dict(orient="records")

    df.to_parquet(parquet_path, index=False)
    return columns, rows, sample_rows, stats


@celery_app.task(bind=True, name=f"{settings.celery_task_prefix}.ingest_file")
def ingest_file(
    self,
    job_id: str,
    bucket: str,
    storage_key: str,
    processed_key: str,
    filename: str,
    header_mode: str = "file",
    custom_headers: list[str] | None = None,
    dataset_type: str | None = None,
    tag_name: str | None = None,
):
    redis = get_sync_redis()
    db = get_sync_db()
    minio = get_minio_client()

    job_doc = db.ingestion_jobs.find_one({"_id": ObjectId(job_id)}) or {}
    owner_email = job_doc.get("owner_email")
    project_id = job_doc.get("project_id")
    filename = job_doc.get("filename", filename)

    ext = os.path.splitext(filename.lower())[-1]
    if ext not in TABULAR_EXTS:
        # should never happen because API forces OFF
        db.ingestion_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": "stored", "progress": 100, "updated_at": datetime.utcnow()}},
        )
        _publish(job_id, states.SUCCESS, 100, "Stored (non-tabular)")
        return

    raw_fd, raw_path = tempfile.mkstemp()
    os.close(raw_fd)

    parquet_fd, parquet_path = tempfile.mkstemp(suffix=".parquet")
    os.close(parquet_fd)

    try:
        _publish(job_id, states.STARTED, 5, "Downloading raw file from MinIO")
        response = minio.get_object(bucket, storage_key)
        try:
            with open(raw_path, "wb") as f:
                for data in response.stream(1024 * 1024):
                    f.write(data)
        finally:
            try:
                response.close()
            except Exception:
                pass
            try:
                response.release_conn()
            except Exception:
                pass

        _publish(job_id, states.STARTED, 35, "Materializing Parquet")
        db.ingestion_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": states.STARTED, "progress": 35, "updated_at": datetime.utcnow()}},
        )

        if ext == ".csv":
            columns, row_count, sample_rows, stats = _csv_to_parquet(
                raw_path, parquet_path, header_mode, custom_headers
            )
        else:
            columns, row_count, sample_rows, stats = _excel_to_parquet(
                raw_path, parquet_path, header_mode, custom_headers
            )

        _publish(job_id, states.STARTED, 80, "Uploading processed Parquet")
        minio.fput_object(bucket, processed_key, parquet_path, content_type="application/octet-stream")

        _publish(job_id, states.SUCCESS, 100, "Upload + processing complete")
        db.ingestion_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {
                "status": states.SUCCESS,
                "progress": 100,
                "processed_key": processed_key,
                "columns": columns,
                "rows_seen": row_count,
                "sample_rows": sample_rows,
                "metadata": {"stats": stats},
                "dataset_type": dataset_type,
                "tag_name": tag_name,
                "header_mode": header_mode,
                "custom_headers": custom_headers,
                "updated_at": datetime.utcnow(),
            }},
        )

        if owner_email:
            create_sync_notification(
                owner_email,
                f"File processed for visualization: {filename}",
                title="Upload processed",
                category="ingestion",
                link=f"/app/projects/{project_id}/data" if project_id else None,
            )

    except Exception as exc:
        _set_status(redis, job_id, states.FAILURE, 100, str(exc))
        redis.publish(f"ingestion:{job_id}:events", json.dumps({"status": states.FAILURE, "progress": 100, "message": str(exc)}))
        db.ingestion_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": states.FAILURE, "progress": 100, "message": str(exc), "updated_at": datetime.utcnow()}},
        )
        raise
    finally:
        for p in (raw_path, parquet_path):
            try:
                if os.path.exists(p):
                    os.remove(p)
            except Exception:
                pass
