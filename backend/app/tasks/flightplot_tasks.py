"""Celery tasks for generating flight data plots.

This task downloads the specified columns from one or more flight data
files, constructs an interactive Plotly figure and stores the result as
an HTML file in object storage. Progress is reported back to the
database document and via the task state so that clients can poll
for updates. Using Plotly (which renders in the browser) avoids
memory pressure on the backend while still producing high-quality
plots for very large data sets.
"""

import io
from typing import List

import pandas as pd
import plotly.graph_objects as go
from celery import states
from celery.utils.log import get_task_logger

from app.core.celery import celery_app
from app.core.minio_client import get_minio_client
from app.core.config import settings
from app.db.mongo import get_db

logger = get_task_logger(__name__)


@celery_app.task(bind=True, name="generate_flightplot")
def generate_flightplot(self, plot_id: str) -> None:
    """Background task to generate an interactive plot.

    Parameters
    ----------
    plot_id: str
        The MongoDB identifier of the plot document in the ``flight_plots``
        collection.  This task will look up the document, stream
        selected columns from object storage, build a Plotly figure and
        store the result in MinIO.  Progress updates are written back
        to the document throughout processing.
    """
    import asyncio

    # Mark task as started
    self.update_state(state=states.STARTED, meta={"progress": 0.0, "message": "Starting plot generation"})

    async def _run() -> None:
        db = await get_db()
        doc = await db.flight_plots.find_one({"_id": plot_id})
        if not doc:
            raise ValueError(f"flight plot {plot_id} not found")
        # Mark as running in the DB
        await db.flight_plots.update_one(
            {"_id": plot_id}, {"$set": {"status": "running", "progress": 0.0}}
        )
        columns: List[dict] = doc["columns"]
        data_series = []
        total_cols = len(columns)
        minio_client = get_minio_client()
        bucket = getattr(settings, "minio_flightdata_bucket", settings.minio_docs_bucket)
        for idx, col in enumerate(columns):
            file_doc = await db.flight_files.find_one({"_id": col["file_id"]})
            if not file_doc:
                raise ValueError(f"flight file {col['file_id']} not found")
            object_key = file_doc["storage_key"]
            response = minio_client.get_object(bucket, object_key)
            try:
                data = response.read()
            finally:
                response.close()
                response.release_conn()
            usecols = [col["column_name"]]
            time_cols = ["time", "time_s", "Time", "Timestamp"]
            for tcol in time_cols:
                if file_doc.get("headers") and tcol in file_doc["headers"]:
                    usecols.append(tcol)
                    break
            try:
                if file_doc.get("content_type", "").startswith("text/csv") or file_doc["original_name"].lower().endswith(".csv"):
                    df = pd.read_csv(io.BytesIO(data), usecols=usecols, engine="pyarrow")
                else:
                    df = pd.read_excel(io.BytesIO(data), usecols=usecols, engine=None)
            except Exception as exc:
                logger.exception("Failed to read data for plot %s", plot_id)
                raise exc
            if len(usecols) == 2:
                x_col = usecols[1]
            else:
                x_col = None
            series = {
                "x": df[x_col] if x_col else list(range(len(df))),
                "y": df[col["column_name"]],
                "name": col.get("label") or col["column_name"],
            }
            data_series.append(series)
            progress = (idx + 1) / total_cols * 0.8  # allocate 80% of progress
            await db.flight_plots.update_one(
                {"_id": plot_id}, {"$set": {"progress": progress}}
            )
            # Also update task state for clients polling Celery
            self.update_state(state=states.STARTED, meta={"progress": progress, "message": f"Processed {idx + 1}/{total_cols} columns"})
        fig = go.Figure()
        for s in data_series:
            fig.add_trace(go.Scatter(x=s["x"], y=s["y"], mode="lines", name=s["name"]))
        title = doc.get("title") or "Flight Data Plot"
        fig.update_layout(title=title, xaxis_title="Index", yaxis_title="Value")
        html = fig.to_html(include_plotlyjs="cdn")
        result_key = f"plots/{plot_id}.html"
        if not minio_client.bucket_exists(bucket):
            minio_client.make_bucket(bucket)
        minio_client.put_object(
            bucket_name=bucket,
            object_name=result_key,
            data=io.BytesIO(html.encode("utf-8")),
            length=len(html.encode("utf-8")),
            content_type="text/html",
        )
        finished_at = pd.Timestamp.utcnow().to_pydatetime()
        await db.flight_plots.update_one(
            {"_id": plot_id},
            {"$set": {
                "status": "completed",
                "progress": 1.0,
                "result_key": result_key,
                "result_url": None,
                "finished_at": finished_at,
            }},
        )
        return

    try:
        loop = asyncio.new_event_loop()
        try:
            asyncio.set_event_loop(loop)
            loop.run_until_complete(_run())
        finally:
            loop.close()
        # Mark task as succeeded
        self.update_state(state=states.SUCCESS, meta={"progress": 1.0, "message": "Plot generated"})
    except Exception as exc:
        # Update the DB status to failed
        try:
            import asyncio as _asyncio
            loop = _asyncio.new_event_loop()
            _asyncio.set_event_loop(loop)
            db = loop.run_until_complete(get_db())
            loop.run_until_complete(
                db.flight_plots.update_one(
                    {"_id": plot_id}, {"$set": {"status": "failed", "progress": 1.0}}
                )
            )
        finally:
            loop.close()
        # Mark task as failure and propagate the exception
        self.update_state(state=states.FAILURE, meta=str(exc))
        raise