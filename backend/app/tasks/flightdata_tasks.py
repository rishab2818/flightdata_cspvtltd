"""Celery tasks for flight data processing.

This module defines a task that extracts the header row from a
flight data file stored in MinIO. The task is executed
asynchronously via Celery so that large files can be processed
without blocking the API server. Progress updates are reported
through the task state.
"""

import io
from typing import List

import pandas as pd
from celery import states
from celery.utils.log import get_task_logger

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
        The MongoDB identifier of the file document in the ``flight_files``
        collection.  This task will look up the document, download the
        file from object storage and update the document with a list
        of column names.

    Returns
    -------
    List[str]
        The list of column names extracted from the file.
    """
    import asyncio

    # Mark task as started with 0 progress
    self.update_state(state=states.STARTED, meta={"progress": 0.0, "message": "Starting header extraction"})

    async def _run() -> List[str]:
        db = await get_db()
        doc = await db.flight_files.find_one({"_id": file_id})
        if not doc:
            raise ValueError(f"flight file {file_id} not found")

        minio_client = get_minio_client()
        bucket = getattr(settings, "minio_flightdata_bucket", settings.minio_docs_bucket)
        object_key = doc["storage_key"]

        # Download entire object into memory. For extremely large files this
        # could be optimised by reading only the first row, but Pandas
        # requires a buffer seek for header inference.
        response = minio_client.get_object(bucket_name=bucket, object_name=object_key)
        try:
            data = response.read()
        finally:
            response.close()
            response.release_conn()

        # Extract headers
        try:
            if doc.get("content_type", "").startswith("text/csv") or doc["original_name"].lower().endswith(".csv"):
                df = pd.read_csv(io.BytesIO(data), nrows=0, engine="pyarrow")
            else:
                df = pd.read_excel(io.BytesIO(data), nrows=0)
            headers = list(df.columns)
        except Exception as exc:
            logger.exception("Failed to parse headers for file %s", file_id)
            raise exc

        # Persist headers back to MongoDB
        await db.flight_files.update_one(
            {"_id": file_id},
            {"$set": {"headers": headers, "headers_extracted_at": pd.Timestamp.utcnow().to_pydatetime()}},
        )
        return headers

    try:
        # Run the async function in a fresh event loop. Using a new event
        # loop avoids interference with Celery's internal loop and works on
        # platforms where no default loop is present (e.g. Windows).
        loop = asyncio.new_event_loop()
        try:
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(_run())
        finally:
            loop.close()
        # Mark task as successful with 100% progress
        self.update_state(state=states.SUCCESS, meta={"progress": 1.0, "message": "Headers extracted"})
        return result
    except Exception as exc:
        # Update task state to failure and propagate the error so Celery
        # records the failure instead of "ignored". Do not raise
        # celery.exceptions.Ignore, which causes an "ignored" status.
        self.update_state(state=states.FAILURE, meta=str(exc))
        raise