"""Celery tasks for flight data processing.

The tasks defined here run outside of the web request context. They
download uploaded files from object storage, read their header row
and persist that metadata back into MongoDB. Using Celery ensures
that large files (potentially hundreds of gigabytes) are parsed
asynchronously and do not block the API server.
"""

import io
from typing import List

import pandas as pd
from celery.utils.log import get_task_logger
from celery import states
from celery.exceptions import Ignore

from app.core.celery import celery_app
from app.core.minio_client import get_minio_client
from app.core.config import settings
from app.db.mongo import get_db

logger = get_task_logger(__name__)


@celery_app.task(bind=True, name="extract_flightdata_headers")
def extract_flightdata_headers(self, file_id: str) -> List[str]:
    """Background task to extract the header row from a flight data file.

    Parameters
    ----------
    file_id: str
        The MongoDB identifier of the file document in the flight_files
        collection. This task will look up the document, download the
        file from object storage and update the document with a list
        of column names.

    Returns
    -------
    List[str]
        The list of column names extracted from the file.
    """
    import asyncio

    async def _run() -> List[str]:
        db = await get_db()
        doc = await db.flight_files.find_one({"_id": file_id})
        if not doc:
            raise ValueError(f"flight file {file_id} not found")

        minio_client = get_minio_client()
        bucket = getattr(settings, "minio_flightdata_bucket", settings.minio_docs_bucket)
        object_key = doc["storage_key"]

        # Stream the object into memory. MinIO returns a response that
        # must be read completely to release resources. We'll load
        # everything into an in‑memory buffer – this is acceptable as
        # Pandas needs to seek within the buffer to determine the
        # header. If file sizes are truly massive the worker can be
        # configured with adequate resources or further optimised
        # (e.g. reading first N bytes). For CSV, nrows=0 avoids
        # reading data rows.
        response = minio_client.get_object(bucket_name=bucket, object_name=object_key)
        try:
            data = response.read()
        finally:
            response.close()
            response.release_conn()

        headers: List[str]
        try:
            if doc.get("content_type", "").startswith("text/csv") or doc["original_name"].lower().endswith(".csv"):
                df = pd.read_csv(io.BytesIO(data), nrows=0)
            else:
                # Excel/other: Pandas will infer engine automatically.
                df = pd.read_excel(io.BytesIO(data), nrows=0)
            headers = list(df.columns)
        except Exception as exc:
            logger.exception("Failed to parse headers for file %s", file_id)
            raise exc

        # Update document with extracted headers and timestamp
        await db.flight_files.update_one(
            {"_id": file_id},
            {"$set": {"headers": headers, "headers_extracted_at": pd.Timestamp.utcnow().to_pydatetime()}},
        )
        return headers

    try:
        return asyncio.get_event_loop().run_until_complete(_run())
    except Exception as exc:
        self.update_state(state=states.FAILURE, meta=str(exc))
        raise Ignore()