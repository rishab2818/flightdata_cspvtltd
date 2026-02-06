

import json
import logging
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


TABULAR_EXTS = {".csv", ".xlsx", ".xls", ".txt", ".dat", ".c", ".mat"}

logger = logging.getLogger(__name__)


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


def _excel_to_parquet(
    xls_path: str,
    parquet_path: str,
    header_mode: str,
    custom_headers: list[str] | None,
    sheet_name: str | int | None = None,
):
    # Default to first sheet when not specified.
    read_kwargs = {"sheet_name": 0 if sheet_name is None else sheet_name}
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
    sheet_name: str | None = None,
    parse_range: dict | None = None,
    mat_config: dict | None = None,
):
    redis = get_sync_redis()
    db = get_sync_db()
    minio = get_minio_client()

    job_doc = db.ingestion_jobs.find_one({"_id": ObjectId(job_id)}) or {}
    owner_email = job_doc.get("owner_email")
    project_id = job_doc.get("project_id")
    filename = job_doc.get("filename", filename)

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

        # if ext == ".csv":
        #     columns, row_count, sample_rows, stats = _csv_to_parquet(
        #         raw_path, parquet_path, header_mode, custom_headers
        #     )
        # else:
        #     columns, row_count, sample_rows, stats = _excel_to_parquet(
        #         raw_path, parquet_path, header_mode, custom_headers
        #     )
        
        ## add functionlity for the wind tunnel txt also 
        if dataset_type == "wind" and ext == ".txt":
            columns, row_count, sample_rows, stats = _wind_txt_to_parquet(
                raw_path, parquet_path, header_mode, custom_headers
            )
        elif ext in {".dat", ".c"}:
            columns, row_count, sample_rows, stats = _text_range_to_parquet(
                raw_path, parquet_path, parse_range
            )
        elif ext == ".mat":
            from app.mat.processor import materialize_mat_parquet
            columns, row_count, sample_rows, stats, mat_meta = materialize_mat_parquet(
                raw_path, parquet_path, mat_config
            )
        elif ext == ".csv":
            columns, row_count, sample_rows, stats = _csv_to_parquet(
                raw_path, parquet_path, header_mode, custom_headers
            )
        else:
            columns, row_count, sample_rows, stats = _excel_to_parquet(
                raw_path,
                parquet_path,
                header_mode,
                custom_headers,
                sheet_name=sheet_name,
            )



        _publish(job_id, states.STARTED, 80, "Uploading processed Parquet")
        minio.fput_object(bucket, processed_key, parquet_path, content_type="application/octet-stream")
        logger.info("ingest_file uploaded parquet job_id=%s processed_key=%s", job_id, processed_key)

        _publish(job_id, states.SUCCESS, 100, "Upload + processing complete")
        meta_payload = {"stats": stats}
        if ext == ".mat" and "mat_meta" in locals():
            meta_payload["mat"] = mat_meta

        db.ingestion_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {
                "status": states.SUCCESS,
                "progress": 100,
                "processed_key": processed_key,
                "columns": columns,
                "rows_seen": row_count,
                "sample_rows": sample_rows,
                "metadata": meta_payload,
                "dataset_type": dataset_type,
                "tag_name": tag_name,
                "header_mode": header_mode,
                "custom_headers": custom_headers,
                "mat_config": mat_config,
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




##  for the txt 
import re

_NUM_RE = re.compile(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?")
_NUM_TOKEN_RE = re.compile(r"^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$")
LEADING_JUNK_RE = re.compile(r'^[\s#\$%&@!;:,._-]+')

def _strip_leading_junk(text: str) -> str:
    return LEADING_JUNK_RE.sub('', text or '')


def _is_numeric_line(line: str) -> bool:
    return bool(_NUM_RE.search(line))

def _extract_numbers(line: str) -> list[float]:
    return [float(x) for x in _NUM_RE.findall(line)]


def _infer_delimiter(lines: list[str]) -> str | None:
    for delim in [",", "\t", ";", "|"]:
        if any(delim in ln for ln in lines):
            return delim
    return None


def _split_line(line: str, delim: str | None) -> list[str]:
    cleaned = _strip_leading_junk(line)

    if delim:
        return [c.strip() for c in cleaned.strip().split(delim) if c.strip()]
    return [c for c in re.split(r"\s+", cleaned.strip()) if c != ""]



def _line_has_string_tokens(line: str, delim: str | None) -> bool:
    tokens = _split_line(line, delim)
    if not tokens:
        return False
    for tok in tokens:
        if tok == "":
            continue
        if not _NUM_TOKEN_RE.match(tok):
            return True
    return False


def _text_range_to_parquet(
    txt_path: str,
    parquet_path: str,
    parse_range: dict | None,
):
    with open(txt_path, "r", errors="ignore") as f:
        lines = f.read().splitlines()

    if not lines:
        raise ValueError("Selected file is empty")

    total_lines = len(lines)
    start = 1
    end = total_lines
    if parse_range:
        start = int(parse_range.get("start_line", 1))
        end = int(parse_range.get("end_line", total_lines))

    if start < 1:
        start = 1
    if start > total_lines:
        start = total_lines
    if end < start:
        end = start
    if end > total_lines:
        end = total_lines

    selected = lines[start - 1 : end]
    selected = [ln for ln in selected if ln.strip()]
    if not selected:
        raise ValueError("Selected range is empty")

    delim = _infer_delimiter(selected)
    header_is_present = _line_has_string_tokens(selected[0], delim)

    data_lines = selected[1:] if header_is_present else selected
    rows: list[list[str | None]] = []
    max_cols = 0
    for ln in data_lines:
        if not ln.strip():
            continue
        cells = _split_line(ln, delim)
        if not cells:
            continue
        rows.append(cells)
        max_cols = max(max_cols, len(cells))

    if not rows or max_cols == 0:
        raise ValueError("No data rows parsed from selected range")

    if header_is_present:
        # headers = _split_line(selected[0], delim)
        # headers = [h.strip() or f"column_{i + 1}" for i, h in enumerate(headers)]
        # if len(headers) < max_cols:
        #     headers += [f"column_{i + 1}" for i in range(len(headers), max_cols)]
        # headers = headers[:max_cols]
        raw_headers = _split_line(selected[0], delim)

        headers = []
        for h in raw_headers:
            clean = _strip_leading_junk(h).strip()
            if clean:
                headers.append(clean)

        # pad if needed
        if len(headers) < max_cols:
            headers += [f"column_{i + 1}" for i in range(len(headers), max_cols)]

        headers = headers[:max_cols]

    else:
        headers = [f"column_{i + 1}" for i in range(max_cols)]

    normalized_rows = []
    for row in rows:
        if len(row) < max_cols:
            row = row + [None] * (max_cols - len(row))
        elif len(row) > max_cols:
            row = row[:max_cols]
        normalized_rows.append(row)

    df = pd.DataFrame(normalized_rows, columns=headers)

    stats: dict = {}
    _update_numeric_stats(stats, df)
    sample_rows = df.head(10).to_dict(orient="records")
    row_count = len(df)

    df.to_parquet(parquet_path, index=False)
    return list(df.columns), row_count, sample_rows, stats

def _wind_txt_to_parquet(
    txt_path: str,
    parquet_path: str,
    header_mode: str,
    custom_headers: list[str] | None,
):
    """
    Wind tunnel TXT parsing rules:
    1) Ignore everything until a line that contains '%Dyn'
    2) From there, collect header tokens until the first numeric line (data start)
    3) Data section: ignore non-numeric lines, keep only numeric rows
    """
    # 1) Read until %Dyn marker
    with open(txt_path, "r", errors="ignore") as f:
        lines = f.readlines()

    start_idx = None
    for i, ln in enumerate(lines):
        if "%Dyn" in ln:
            start_idx = i
            break

    if start_idx is None:
        raise ValueError("Wind TXT: '%Dyn' marker not found")

    # 2) Build columns until first numeric row
    header_tokens: list[str] = []
    data_start = None

    for i in range(start_idx, len(lines)):
        ln = lines[i].strip()
        if not ln:
            continue

        # first numeric row => stop header capture
        if _is_numeric_line(ln):
            data_start = i
            break

        # collect header tokens (words)
        # toks = ln.split()
        toks = [t.strip().lstrip('%') for t in ln.split(',') if t.strip()]


        # keep everything (including %Dyn itself)
        header_tokens.extend(toks)

    if data_start is None:
        raise ValueError("Wind TXT: no numeric data found after header")

    # Apply header_mode overrides (same semantics as CSV/Excel)
    if header_mode == "custom":
        if not custom_headers:
            raise ValueError("custom_headers required when header_mode=custom")
        columns = custom_headers
    elif header_mode == "none":
        # number of cols from detected header, else infer from first numeric row length
        if header_tokens:
            n = len(header_tokens)
        else:
            n = len(_extract_numbers(lines[data_start]))
        columns = [f"column_{i+1}" for i in range(n)]
    else:
        # file headers
        columns = header_tokens if header_tokens else [f"column_{i+1}" for i in range(len(_extract_numbers(lines[data_start])))]

    # 3) Parse numeric rows only
    rows: list[list[float | None]] = []
    stats: dict = {}

    for i in range(data_start, len(lines)):
        ln = lines[i].strip()
        if not ln:
            continue

        nums = _extract_numbers(ln)
        if not nums:
            # ignore text line inside data section
            continue

        # align row length to columns count
        if len(nums) > len(columns):
            nums = nums[: len(columns)]
        elif len(nums) < len(columns):
            nums = nums + [None] * (len(columns) - len(nums))

        rows.append(nums)

    if not rows:
        raise ValueError("Wind TXT: no numeric rows parsed")

    df = pd.DataFrame(rows, columns=columns)

    # compute stats (uses your existing helper)
    _update_numeric_stats(stats, df)

    sample_rows = df.head(10).to_dict(orient="records")
    row_count = len(df)

    df.to_parquet(parquet_path, index=False)

    return list(df.columns), row_count, sample_rows, stats
