"""
Routes for creating and managing flight data plots.

This router allows users to schedule the generation of plots based on
selected columns from one or more flight data files, check progress,
retrieve completed plots and manage access. Plot generation is
performed asynchronously by a Celery worker to ensure that very large
files can be processed without blocking the API server or exhausting
memory.
"""

from datetime import datetime, timedelta
from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user, CurrentUser
from app.core.minio_client import get_minio_client
from app.core.config import settings
from app.db.mongo import get_db
from app.models.flight_plot import PlotCreate, PlotOut, PlotColumn
from app.models.flight_data import FlightDataSection
from app.tasks.flightplot_tasks import generate_flightplot


router = APIRouter(prefix="/api/flightplots", tags=["flightplots"])


async def _ensure_project_member(db, project_id: str, user_email: str) -> None:
    """Verify that a user is a member of the given project.

    Raises 404 if project not found or user not a member.
    """
    proj = await db.projects.find_one({"_id": ObjectId(project_id), "members.email": user_email})
    if not proj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or no access",
        )


class ShareRequest(BaseModel):
    user_email: str = Field(..., description="Email of user to share access with")


@router.post("/init", response_model=PlotOut)
async def init_plot(
    body: PlotCreate,
    user: CurrentUser = Depends(get_current_user),
):
    """Create a new plot and schedule asynchronous generation.

    The client provides a list of file/column pairs and an optional title.
    A document is inserted into the ``flight_plots`` collection with
    status ``pending`` and progress 0. A Celery task is queued to
    generate the plot. Only project members may create plots.
    """
    db = await get_db()
    # Validate project membership
    await _ensure_project_member(db, body.project_id, user.email)
    # Insert plot document
    now = datetime.utcnow()
    plot_doc = {
        "project_id": body.project_id,
        "owner_email": user.email,
        "columns": [c.model_dump() for c in body.columns],
        "title": body.title,
        "status": "pending",
        "progress": 0.0,
        "result_key": None,
        "created_at": now,
        "finished_at": None,
        "access_emails": [],
    }
    res = await db.flight_plots.insert_one(plot_doc)
    plot_id = str(res.inserted_id)
    # Schedule Celery task
    generate_flightplot.delay(plot_id)
    return PlotOut(
        plot_id=plot_id,
        project_id=body.project_id,
        owner_email=user.email,
        columns=body.columns,
        title=body.title,
        status="pending",
        progress=0.0,
        result_url=None,
        created_at=now,
        finished_at=None,
        access_emails=[],
    )


@router.get("", response_model=List[PlotOut])
async def list_plots(
    project_id: str = Query(..., description="Project ID to list plots from"),
    user: CurrentUser = Depends(get_current_user),
):
    """List all plots visible to the current user within a project.

    A plot is visible if the user is the owner or has been granted
    access via its ``access_emails`` list.
    """
    db = await get_db()
    # Confirm membership
    await _ensure_project_member(db, project_id, user.email)
    query: dict = {"project_id": project_id}
    query["$or"] = [
        {"owner_email": user.email},
        {"access_emails": user.email},
    ]
    cursor = db.flight_plots.find(query).sort("created_at", -1)
    rows = await cursor.to_list(length=100)
    results: List[PlotOut] = []
    for row in rows:
        results.append(
            PlotOut(
                plot_id=str(row["_id"]),
                project_id=row["project_id"],
                owner_email=row["owner_email"],
                columns=[PlotColumn(**c) for c in row["columns"]],
                title=row.get("title"),
                status=row["status"],
                progress=row.get("progress", 0.0),
                result_url=row.get("result_url"),
                created_at=row["created_at"],
                finished_at=row.get("finished_at"),
                access_emails=row.get("access_emails", []),
            )
        )
    return results


@router.get("/{plot_id}/status", response_model=PlotOut)
async def get_plot_status(
    plot_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Get the current status and progress of a plot."""
    db = await get_db()
    doc = await db.flight_plots.find_one({"_id": ObjectId(plot_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Plot not found")
    # Ensure user has access
    if doc["owner_email"] != user.email and user.email not in doc.get("access_emails", []):
        raise HTTPException(status_code=403, detail="No access to this plot")
    return PlotOut(
        plot_id=str(doc["_id"]),
        project_id=doc["project_id"],
        owner_email=doc["owner_email"],
        columns=[PlotColumn(**c) for c in doc["columns"]],
        title=doc.get("title"),
        status=doc["status"],
        progress=doc.get("progress", 0.0),
        result_url=doc.get("result_url"),
        created_at=doc["created_at"],
        finished_at=doc.get("finished_at"),
        access_emails=doc.get("access_emails", []),
    )


@router.get("/{plot_id}", response_model=PlotOut)
async def get_plot(
    plot_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Retrieve a plot and its result URL when completed."""
    return await get_plot_status(plot_id, user)


@router.delete("/{plot_id}")
async def delete_plot(
    plot_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Delete a plot and its associated result from storage.

    Only the owner can delete a plot. This removes the document from
    the ``flight_plots`` collection and deletes the stored plot file
    from object storage.
    """
    db = await get_db()
    doc = await db.flight_plots.find_one({"_id": ObjectId(plot_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Plot not found")
    if doc["owner_email"] != user.email:
        raise HTTPException(status_code=403, detail="Only the owner can delete plots")
    # Remove from storage if result exists
    if doc.get("result_key"):
        minio_client = get_minio_client()
        bucket = getattr(settings, "minio_flightdata_bucket", settings.minio_docs_bucket)
        minio_client.remove_object(bucket, doc["result_key"])
    # Delete document
    await db.flight_plots.delete_one({"_id": ObjectId(plot_id)})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------

@router.get("/{plot_id}/download-url")
async def get_plot_download_url(
    plot_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Generate a presigned URL for downloading the rendered plot HTML.

    Only owners and users with access may request a download URL. The
    HTML file can be embedded directly in the frontend or opened in a new
    tab.
    """
    db = await get_db()
    doc = await db.flight_plots.find_one({"_id": ObjectId(plot_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Plot not found")
    # Check access
    if doc["owner_email"] != user.email and user.email not in doc.get("access_emails", []):
        raise HTTPException(status_code=403, detail="No access to download this plot")
    if doc.get("status") != "completed" or not doc.get("result_key"):
        raise HTTPException(status_code=400, detail="Plot is not yet available")
    minio_client = get_minio_client()
    bucket = getattr(settings, "minio_flightdata_bucket", settings.minio_docs_bucket)
    url = minio_client.presigned_get_object(bucket, doc["result_key"], expires=timedelta(hours=1))
    return {"download_url": url}


@router.post("/{plot_id}/share")
async def share_plot(
    plot_id: str,
    payload: ShareRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """Share a plot with another user by email.

    Only the owner can share a plot. The provided email must correspond to
    a member of the project. If the user already has access, the
    operation is idempotent.
    """
    db = await get_db()
    doc = await db.flight_plots.find_one({"_id": ObjectId(plot_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Plot not found")
    # Check ownership
    if doc["owner_email"] != user.email:
        raise HTTPException(status_code=403, detail="Only the owner can share plots")
    # Ensure target is a member of the project
    await _ensure_project_member(db, doc["project_id"], payload.user_email)
    # Idempotently add user to access list
    await db.flight_plots.update_one(
        {"_id": ObjectId(plot_id)},
        {"$addToSet": {"access_emails": payload.user_email}},
    )
    return {"ok": True}