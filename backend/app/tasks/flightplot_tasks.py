"""
Celery tasks for generating flight data plots.

This task downloads the specified columns from one or more flight data
files, constructs an interactive Plotly figure and stores the result as
an HTML file in object storage. Progress is reported back to the
database document so that clients can poll for updates. Using
Plotly (which renders in the browser) avoids memory pressure on the
backend while still producing high-quality plots for very large data
sets.
"""

import io
from typing import List

import pandas as pd
import plotly.graph_objects as go
from celery.utils.log import get_task_logger
from celery import states
from celery.exceptions import Ignore

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

    async def _run() -> None:
        db = await get_db()
        doc = await db.flight_plots.find_one({"_id": plot_id})
        if not doc:
            raise ValueError(f"flight plot {plot_id} not found")
        # Mark as running
        await db.flight_plots.update_one(
            {"_id": plot_id}, {"$set": {"status": "running", "progress": 0.0}}
        )
        columns: List[dict] = doc["columns"]
        # Each element: {'file_id':..., 'column_name':..., 'label':...}
        data_series = []
        total_cols = len(columns)
        minio_client = get_minio_client()
        bucket = getattr(settings, "minio_flightdata_bucket", settings.minio_docs_bucket)
        # Read each column separately to limit memory usage
        for idx, col in enumerate(columns):
            file_doc = await db.flight_files.find_one({"_id": col["file_id"]})
            if not file_doc:
                raise ValueError(f"flight file {col['file_id']} not found")
            object_key = file_doc["storage_key"]
            # Download object
            response = minio_client.get_object(bucket, object_key)
            try:
                data = response.read()
            finally:
                response.close()
                response.release_conn()
            # Determine file type and read only selected columns
            usecols = [col["column_name"]]
            # Always include 'time' or similar if present to use as x-axis
            time_cols = ["time", "time_s", "Time", "Timestamp"]
            for tcol in time_cols:
                # add time col if exists in headers
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
            # Set x-axis
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
            # Update progress
            progress = (idx + 1) / total_cols * 0.8  # 80% reserved for data loading
            await db.flight_plots.update_one(
                {"_id": plot_id}, {"$set": {"progress": progress}}
            )
        # Build Plotly figure
        fig = go.Figure()
        for s in data_series:
            fig.add_trace(
                go.Scatter(x=s["x"], y=s["y"], mode="lines", name=s["name"])
            )
        title = doc.get("title") or "Flight Data Plot"
        fig.update_layout(title=title, xaxis_title="Index", yaxis_title="Value")
        # Serialize to HTML
        html = fig.to_html(include_plotlyjs="cdn")
        # Store result in MinIO
        result_key = f"plots/{plot_id}.html"
        # Ensure bucket exists
        if not minio_client.bucket_exists(bucket):
            minio_client.make_bucket(bucket)
        minio_client.put_object(
            bucket_name=bucket,
            object_name=result_key,
            data=io.BytesIO(html.encode("utf-8")),
            length=len(html.encode("utf-8")),
            content_type="text/html",
        )
        # Update document with completion
        finished_at = pd.Timestamp.utcnow().to_pydatetime()
        await db.flight_plots.update_one(
            {"_id": plot_id},
            {"$set": {
                "status": "completed",
                "progress": 1.0,
                "result_key": result_key,
                "result_url": None,  # will be generated lazily via presigned URL
                "finished_at": finished_at,
            }},
        )
        return

    try:
        asyncio.get_event_loop().run_until_complete(_run())
    except Exception as exc:
        # Mark as failure
        self.update_state(state=states.FAILURE, meta=str(exc))
        try:
            import asyncio as _asyncio
            db = asyncio.get_event_loop().run_until_complete(get_db())
            asyncio.get_event_loop().run_until_complete(
                db.flight_plots.update_one(
                    {"_id": plot_id},
                    {"$set": {"status": "failed", "progress": 1.0}},
                )
            )
        except Exception:
            pass
        raise Ignore()