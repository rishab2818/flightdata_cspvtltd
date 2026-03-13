import io
import json
import logging
import os
import tempfile
import re
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
from app.text_formats import (
    RANGE_TEXT_EXTENSIONS,
    TABULAR_EXTENSIONS,
    text_range_stream_to_parquet,
)

TABULAR_EXTS = TABULAR_EXTENSIONS

logger = logging.getLogger(__name__)
MINIO_STREAM_CHUNK_SIZE =  8 * 1024 * 1024  # approx 8mb chunks 
NUM_TOKEN_RE = re.compile(r"^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$")


class _ByteProgressPublisher:
    def __init__(self, job_id: str, total_bytes: int | None, start: int, end: int, message: str):
        self.job_id = job_id
        self.total_bytes = int(total_bytes) if total_bytes else None
        self.start = start
        self.end = end
        self.message = message
        self.bytes_seen = 0
        self.last_progress = start

    def on_chunk(self, size: int):
        if not size:
            return
        self.bytes_seen += int(size)
        if not self.total_bytes or self.total_bytes <= 0:
            return
        ratio = min(1.0, self.bytes_seen / self.total_bytes)
        progress = int(self.start + (self.end - self.start) * ratio)
        if progress > self.last_progress:
            self.last_progress = progress
            _publish(self.job_id, states.STARTED, progress, self.message)

    def finish(self):
        if self.end > self.last_progress:
            self.last_progress = self.end
            _publish(self.job_id, states.STARTED, self.end, self.message)


class _MinioChunkReader(io.RawIOBase):
    """Expose MinIO chunk iterator as a readable binary stream."""

    def __init__(self, chunks, on_chunk=None):
        self._chunks = iter(chunks)
        self._buffer = b""
        self._eof = False
        self._on_chunk = on_chunk

    def readable(self):
        return True

    def readinto(self, b):
        if self._eof:
            return 0

        view = memoryview(b)
        total = 0

        while total < len(view):
            if not self._buffer:
                try:
                    self._buffer = next(self._chunks)
                except StopIteration:
                    self._eof = True
                    break
                if not self._buffer:
                    continue
                if self._on_chunk:
                    self._on_chunk(len(self._buffer))

            take = min(len(self._buffer), len(view) - total)
            view[total:total + take] = self._buffer[:take]
            self._buffer = self._buffer[take:]
            total += take

        return total


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


def _is_empty_row(row: pd.Series) -> bool:
    for value in row.tolist():
        if pd.isna(value):
            continue
        if isinstance(value, str) and value.strip() == "":
            continue
        return False
    return True


def _drop_fully_empty_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Drop columns that are empty in all rows (NaN or blank strings).
    """
    if df.empty:
        return df
    keep_cols = []
    for col in df.columns:
        series = df[col]
        has_value = False
        for value in series.tolist():
            if pd.isna(value):
                continue
            if isinstance(value, str) and value.strip() == "":
                continue
            has_value = True
            break
        if has_value:
            keep_cols.append(col)
    return df[keep_cols].copy()


def _trim_to_primary_data_block(df: pd.DataFrame, blank_run_stop: int = 2) -> pd.DataFrame:
    """
    Keep only the first contiguous tabular block.
    This removes lower chart/annotation areas that are separated by blank gaps.
    """
    if df.empty:
        return df

    start_idx = None
    for idx in range(len(df)):
        if not _is_empty_row(df.iloc[idx]):
            start_idx = idx
            break
    if start_idx is None:
        return df.iloc[0:0].copy()

    end_idx = len(df)
    blank_run = 0
    for idx in range(start_idx, len(df)):
        if _is_empty_row(df.iloc[idx]):
            blank_run += 1
            if blank_run >= blank_run_stop:
                end_idx = idx - blank_run + 1
                break
        else:
            blank_run = 0

    return df.iloc[start_idx:end_idx].reset_index(drop=True)


def _dummy_columns(count: int) -> list[str]:
    return [f"column{i + 1}" for i in range(int(count or 0))]


def _is_numeric_token(value: str) -> bool:
    return bool(NUM_TOKEN_RE.match(str(value or "").strip()))


def _mostly_numeric(values: list[str]) -> bool:
    tokens = [str(v or "").strip() for v in values if str(v or "").strip()]
    if not tokens:
        return False
    numeric = sum(1 for token in tokens if _is_numeric_token(token))
    return (numeric / len(tokens)) >= 0.6


def _sanitize_header_value(value, idx: int) -> str:
    text = str(value or "").strip()
    if not text or text.lower() == "nan":
        return f"column{idx + 1}"
    return text


def _make_unique_columns(columns: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    out: list[str] = []
    for idx, raw in enumerate(columns):
        base = str(raw or "").strip() or f"column{idx + 1}"
        count = seen.get(base, 0) + 1
        seen[base] = count
        out.append(base if count == 1 else f"{base}_{count}")
    return out


def _should_treat_first_row_as_header(df: pd.DataFrame) -> bool:
    if df.empty:
        return False

    first_row = [str(v or "").strip() for v in df.iloc[0].tolist()]
    first_tokens = [token for token in first_row if token and token.lower() != "nan"]
    if len(first_tokens) < 2:
        return False
    if not any(not _is_numeric_token(token) for token in first_tokens):
        return False

    if len(df) <= 1:
        return True

    second_row = [str(v or "").strip() for v in df.iloc[1].tolist()]
    if _mostly_numeric(second_row):
        return True

    # Ambiguous mixed/text datasets are safer to treat as header-present to
    # preserve existing "file headers" behavior.
    return True


def _apply_header_mode(df: pd.DataFrame, header_mode: str, custom_headers: list[str] | None):
    if header_mode == "file":
        if _should_treat_first_row_as_header(df):
            raw_headers = [_sanitize_header_value(v, idx) for idx, v in enumerate(df.iloc[0].tolist())]
            df = df.iloc[1:].reset_index(drop=True)
            df.columns = _make_unique_columns(raw_headers)
        else:
            df.columns = _dummy_columns(len(df.columns))
    elif header_mode == "none" and not custom_headers:
        df.columns = _dummy_columns(len(df.columns))
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


def _coerce_object_columns_for_parquet(df: pd.DataFrame) -> pd.DataFrame:
    """
    Arrow cannot always infer mixed object columns (e.g., mostly numeric values
    with occasional text labels). Normalize object columns before parquet write:
    - if fully numeric-like -> numeric dtype
    - if mostly numeric-like -> numeric dtype with non-numeric values as NaN
    - otherwise -> pandas string dtype
    """
    out = df.copy()
    for col in out.columns:
        series = out[col]
        if not pd.api.types.is_object_dtype(series.dtype):
            continue

        non_null = series.dropna()
        if non_null.empty:
            continue

        numeric_series = pd.to_numeric(series, errors="coerce")
        numeric_count = int(numeric_series.notna().sum())
        total_count = int(non_null.shape[0])

        if numeric_count == total_count:
            out[col] = numeric_series
            continue

        ratio = numeric_count / max(total_count, 1)
        if ratio >= 0.70:
            out[col] = numeric_series
        else:
            out[col] = series.astype("string")

    return out


def _csv_to_parquet(csv_source, parquet_path: str, header_mode: str, custom_headers: list[str] | None):
    # Use chunking to avoid loading the whole file
    read_kwargs = {}
    if header_mode in ("file", "none", "custom"):
        read_kwargs["header"] = None
    else:
        read_kwargs["header"] = 0

    chunks = pd.read_csv(csv_source, chunksize=200_000, **read_kwargs)

    writer = None
    stats = {}
    columns = None
    rows = 0
    sample_rows = None
    source_is_path = isinstance(csv_source, (str, os.PathLike))

    for i, chunk in enumerate(chunks):
        if header_mode == "file":
            if columns is None:
                chunk = _apply_header_mode(chunk, header_mode, custom_headers)
                columns = list(chunk.columns)
            else:
                if len(columns) != len(chunk.columns):
                    raise ValueError("Detected column count changed while reading CSV")
                chunk.columns = columns
        else:
            chunk = _apply_header_mode(chunk, header_mode, custom_headers)
            if columns is None:
                columns = list(chunk.columns)

        if sample_rows is None:
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
        if source_is_path:
            # fallback path: re-read fully (only OK for small files)
            df = pd.read_csv(csv_source, **read_kwargs)
            df = _apply_header_mode(df, header_mode, custom_headers)
            _update_numeric_stats(stats, df)
            rows = len(df)
            sample_rows = df.head(10).to_dict(orient="records")
            df.to_parquet(parquet_path, index=False)
        elif rows == 0:
            raise ValueError("Selected file is empty")
        else:
            raise ValueError("pyarrow is required for streaming CSV ingestion")

    return columns or [], rows, sample_rows or [], stats


def _csv_stream_to_parquet(
    csv_chunks,
    parquet_path: str,
    header_mode: str,
    custom_headers: list[str] | None,
    on_chunk=None,
):
    stream = _MinioChunkReader(csv_chunks, on_chunk=on_chunk)
    buffered = io.BufferedReader(stream, buffer_size=MINIO_STREAM_CHUNK_SIZE)
    text_stream = io.TextIOWrapper(buffered, encoding="utf-8", errors="ignore", newline="")
    try:
        return _csv_to_parquet(text_stream, parquet_path, header_mode, custom_headers)
    finally:
        try:
            text_stream.close()
        except Exception:
            pass


def _download_response_to_path(response, target_path: str, on_chunk=None):
    with open(target_path, "wb") as handle:
        for data in response.stream(MINIO_STREAM_CHUNK_SIZE):
            if data:
                if on_chunk:
                    on_chunk(len(data))
                handle.write(data)


def _resolve_object_size(minio, bucket: str, object_name: str, fallback):
    if fallback:
        try:
            return int(fallback)
        except Exception:
            pass
    try:
        stat = minio.stat_object(bucket, object_name)
        if stat and getattr(stat, "size", None) is not None:
            return int(stat.size)
    except Exception:
        logger.debug("Could not resolve object size for %s", object_name, exc_info=True)
    return None


# def _excel_to_parquet(
#     xls_path: str,
#     parquet_path: str,
#     header_mode: str,
#     custom_headers: list[str] | None,
#     sheet_name: str | int | None = None,
# ):
#     # Default to first sheet when not specified.
#     read_kwargs = {"sheet_name": 0 if sheet_name is None else sheet_name}
#     if header_mode in ("none", "custom"):
#         read_kwargs["header"] = None
#     else:
#         read_kwargs["header"] = 0

#     df = pd.read_excel(xls_path, **read_kwargs)
#     df = _clean_excel_df(df)
#     df = _apply_header_mode(df, header_mode, custom_headers)

#     stats = {}
#     _update_numeric_stats(stats, df)
#     columns = list(df.columns)
#     rows = len(df)
#     sample_rows = df.head(10).to_dict(orient="records")

#     df.to_parquet(parquet_path, index=False)
#     return columns, rows, sample_rows, stats

def _spreadsheet_to_parquet(
    xls_path: str,
    parquet_path: str,
    header_mode: str,
    custom_headers: list[str] | None,
    file_ext: str,
    sheet_name: str | int | None = None,
):
    # ext = os.path.splitext(str(xls_path).lower())[-1]
    ext = str(file_ext or "").lower()

    # Default to first sheet when not specified.
    read_kwargs = {"sheet_name": 0 if sheet_name is None else sheet_name}
    if header_mode in ("file", "none", "custom"):
        read_kwargs["header"] = None
    else:
        read_kwargs["header"] = 0

    if ext == ".ods":
        df = pd.read_excel(xls_path, engine="odf", **read_kwargs)
    else:
        df = pd.read_excel(xls_path, **read_kwargs)

    df = _clean_excel_df(df)
    df = _trim_to_primary_data_block(df, blank_run_stop=2)
    df = _apply_header_mode(df, header_mode, custom_headers)
    df = _drop_fully_empty_columns(df)
    df = _coerce_object_columns_for_parquet(df)

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
    processed_key: str | None,
    filename: str,
    header_mode: str = "file",
    custom_headers: list[str] | None = None,
    dataset_type: str | None = None,
    tag_name: str | None = None,
    sheet_name: str | None = None,
    parse_range: dict | None = None,
):
    redis = get_sync_redis()
    db = get_sync_db()
    minio = get_minio_client()

    job_doc = db.ingestion_jobs.find_one({"_id": ObjectId(job_id)}) or {}
    owner_email = job_doc.get("owner_email")
    project_id = job_doc.get("project_id")
    filename = job_doc.get("filename", filename)
    size_bytes = _resolve_object_size(minio, bucket, storage_key, job_doc.get("size_bytes"))

    ext = os.path.splitext(filename.lower())[-1]
    logger.info(
        "ingest_file start job_id=%s ext=%s filename=%s processed_key=%s dataset_type=%s tag=%s",
        job_id,
        ext,
        filename,
        processed_key,
        dataset_type,
        tag_name,
    )
    if ext not in TABULAR_EXTS:
        # should never happen because API forces OFF
        db.ingestion_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": "stored", "progress": 100, "updated_at": datetime.utcnow()}},
        )
        _publish(job_id, states.SUCCESS, 100, "Stored (non-tabular)")
        return

    raw_path = None
    if ext in {".xlsx", ".xls", ".ods",".mat"}:
        raw_fd, raw_path = tempfile.mkstemp()
        os.close(raw_fd)

    parquet_path = None
    if ext != ".mat":
        parquet_fd, parquet_path = tempfile.mkstemp(suffix=".parquet")
        os.close(parquet_fd)

    try:
        _publish(job_id, states.STARTED, 5, "Opening MinIO stream")
        db.ingestion_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": states.STARTED, "progress": 10, "updated_at": datetime.utcnow()}},
        )

        response = minio.get_object(bucket, storage_key)
        try:
            columns: list[str] = []
            row_count = 0
            sample_rows: list[dict] = []
            stats: dict = {}
            mat_meta: dict | None = None
            processed_key_to_store = processed_key

            if ext in RANGE_TEXT_EXTENSIONS:
                if not parquet_path:
                    raise ValueError("parquet_path is required for text ingestion")
                _publish(job_id, states.STARTED, 35, "Streaming + parsing line-based text data")
                parse_progress = _ByteProgressPublisher(
                    job_id,
                    total_bytes=size_bytes,
                    start=35,
                    end=75,
                    message="Streaming + parsing line-based text data",
                )
                columns, row_count, sample_rows, stats = text_range_stream_to_parquet(
                    response.stream(MINIO_STREAM_CHUNK_SIZE),
                    parquet_path,
                    parse_range,
                    on_chunk=parse_progress.on_chunk,
                )
                parse_progress.finish()
            elif ext == ".csv":
                if not parquet_path:
                    raise ValueError("parquet_path is required for CSV ingestion")
                _publish(job_id, states.STARTED, 35, "Streaming + parsing CSV data")
                parse_progress = _ByteProgressPublisher(
                    job_id,
                    total_bytes=size_bytes,
                    start=35,
                    end=75,
                    message="Streaming + parsing CSV data",
                )
                columns, row_count, sample_rows, stats = _csv_stream_to_parquet(
                    response.stream(MINIO_STREAM_CHUNK_SIZE),
                    parquet_path,
                    header_mode,
                    custom_headers,
                    on_chunk=parse_progress.on_chunk,
                )
                parse_progress.finish()
            else:
                if not raw_path:
                    raise ValueError("raw_path is required for this file type")
                _publish(job_id, states.STARTED, 20, "Downloading raw file in chunks from MinIO")
                download_progress = _ByteProgressPublisher(
                    job_id,
                    total_bytes=size_bytes,
                    start=20,
                    end=45,
                    message="Downloading raw file in chunks from MinIO",
                )
                _download_response_to_path(response, raw_path, on_chunk=download_progress.on_chunk)
                download_progress.finish()

                # MAT indexing and Excel parsing need random access; parse after chunked download to local disk.
                if ext == ".mat":
                    from app.mat.indexing import index_mat

                    _publish(job_id, states.STARTED, 60, "Indexing MAT variables")
                    mat_meta = index_mat(raw_path).model_dump()
                    processed_key_to_store = None
                else:
                    if not parquet_path:
                        raise ValueError("parquet_path is required for spreadsheet ingestion")
                    _publish(job_id, states.STARTED, 60, "Preparing spreadsheet data")
                    columns, row_count, sample_rows, stats = _spreadsheet_to_parquet(
    raw_path,
    parquet_path,
    header_mode,
    custom_headers,
    ext,
    sheet_name=sheet_name,
)
                    # _publish(job_id, states.STARTED, 60, "Preparing Excel data")
                    # columns, row_count, sample_rows, stats = _excel_to_parquet(
                    #     raw_path,
                    #     parquet_path,
                    #     header_mode,
                    #     custom_headers,
                    #     sheet_name=sheet_name,
                    # )
        finally:
            try:
                response.close()
            except Exception:
                pass
            try:
                response.release_conn()
            except Exception:
                pass

        if ext != ".mat":
            _publish(job_id, states.STARTED, 80, "Uploading processed Parquet")
            if not parquet_path:
                raise ValueError("parquet_path is required for upload")
            if not processed_key:
                raise ValueError("processed_key is required for non-MAT ingestion")
            minio.fput_object(bucket, processed_key, parquet_path, content_type="application/octet-stream")
            logger.info("ingest_file uploaded parquet job_id=%s processed_key=%s", job_id, processed_key)

        _publish(job_id, states.SUCCESS, 100, "Upload + processing complete")
        meta_payload = {"stats": stats}
        if mat_meta is not None:
            meta_payload["mat"] = mat_meta

        db.ingestion_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {
                "status": states.SUCCESS,
                "progress": 100,
                "processed_key": processed_key_to_store,
                "columns": columns,
                "rows_seen": row_count,
                "sample_rows": sample_rows,
                "metadata": meta_payload,
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
            {"$set": {
                "status": states.FAILURE,
                "progress": 100,
                "message": str(exc),
                "processed_key": None,
                "updated_at": datetime.utcnow()
            }},
        )
        raise
    finally:
        for p in (raw_path, parquet_path):
            try:
                if os.path.exists(p):
                    os.remove(p)
            except Exception:
                pass
