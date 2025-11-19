"""
Routes for project‑scoped flight data file uploads.

This router exposes CRUD operations for uploading large CSV/Excel
files that contain flight data. Files are organised by project and
section and are private to the uploading user by default. Owners can
share individual files with other users by email. Column names are
extracted asynchronously via Celery.
"""

from datetime import datetime, timedelta
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user, CurrentUser
from app.core.minio_client import get_minio_client
from app.core.config import settings
from app.db.mongo import get_db
from app.models.flight_data import (
    FlightDataSection,
    FlightDataInitUpload,
    FlightDataConfirm,
    FlightDataFileOut,
)

from app.tasks.flightdata_tasks import extract_flightdata_headers
from pydantic import BaseModel, Field


router = APIRouter(prefix="/api/flightdata", tags=["flightdata"])


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


async def _dedupe_check(db, project_id: str, user_email: str, content_hash: str) -> None:
    """Ensure the user hasn't already uploaded the same file to this project.

    If a document exists with the same uploader and hash within the project,
    raise a 409 conflict.
    """
    existing = await db.flight_files.find_one(
        {
            "project_id": project_id,
            "owner_email": user_email,
            "content_hash": content_hash,
        }
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Duplicate file: this content has already been uploaded for this project and user.",
        )


@router.post("/init-upload")
async def init_flightdata_upload(
    payload: FlightDataInitUpload,
    user: CurrentUser = Depends(get_current_user),
):
    """Generate a presigned URL to upload a flight data file.

    The client must first call this to obtain credentials for a direct
    upload to object storage. We perform a dedupe check before
    generating the URL to ensure identical files are not uploaded
    repeatedly.
    """
    db = await get_db()
    # Ensure user is part of the project
    await _ensure_project_member(db, payload.project_id, user.email)
    # Deduplication
    await _dedupe_check(db, payload.project_id, user.email, payload.content_hash)

    minio_client = get_minio_client()
    # Use a dedicated bucket or fall back to docs bucket
    bucket = getattr(settings, "minio_flightdata_bucket", settings.minio_docs_bucket)
    # Compose object key: projects/<project>/<user>/<section>/<uuid>_<filename>
    key_parts = ["projects", payload.project_id, user.email, payload.section.value]
    import uuid

    object_prefix = "/".join(key_parts)
    object_key = f"{object_prefix}/{uuid.uuid4()}_{payload.filename}"
    # Ensure bucket exists
    if not minio_client.bucket_exists(bucket):
        minio_client.make_bucket(bucket)

    upload_url = minio_client.presigned_put_object(
        bucket_name=bucket,
        object_name=object_key,
        expires=timedelta(hours=1),
    )
    return {
        "upload_url": upload_url,
        "storage_key": object_key,
        "bucket": bucket,
        "expires_in": 3600,
    }


@router.post("/confirm", response_model=FlightDataFileOut)
async def confirm_flightdata_upload(
    payload: FlightDataConfirm,
    user: CurrentUser = Depends(get_current_user),
):
    """Register a flight data file once it has been uploaded.

    Inserts a document into the ``flight_files`` collection and kicks off
    an asynchronous task to extract column headers. Returns the
    persisted metadata to the client.
    """
    db = await get_db()
    await _ensure_project_member(db, payload.project_id, user.email)
    await _dedupe_check(db, payload.project_id, user.email, payload.content_hash)

    now = datetime.utcnow()
    doc = {
        "project_id": payload.project_id,
        "owner_email": user.email,
        "section": payload.section.value,
        "original_name": payload.original_name,
        "storage_key": payload.storage_key,
        "content_type": payload.content_type,
        "size_bytes": payload.size_bytes,
        "content_hash": payload.content_hash,
        "uploaded_at": now,
        "headers": None,
        "access_emails": [],
    }
    res = await db.flight_files.insert_one(doc)
    file_id = str(res.inserted_id)
    # Trigger background processing
    extract_flightdata_headers.delay(file_id)
    return FlightDataFileOut(
        file_id=file_id,
        project_id=payload.project_id,
        owner_email=user.email,
        section=payload.section.value,
        original_name=payload.original_name,
        storage_key=payload.storage_key,
        size_bytes=payload.size_bytes,
        content_type=payload.content_type,
        uploaded_at=now,
        headers=None,
        access_emails=[],
    )


@router.get("", response_model=List[FlightDataFileOut])
async def list_flightdata_files(
    project_id: str = Query(..., description="Project ID to list files from"),
    section: Optional[FlightDataSection] = Query(None, description="Optional section filter"),
    user: CurrentUser = Depends(get_current_user),
):
    """List all flight data files visible to the current user within a project.

    A file is visible if the user is the owner or has been granted
    access via its ``access_emails`` list.
    """
    db = await get_db()
    # Confirm membership
    await _ensure_project_member(db, project_id, user.email)

    query: dict = {"project_id": project_id}
    if section:
        query["section"] = section.value
    # Only return files where user is owner or in access_emails
    query["$or"] = [
        {"owner_email": user.email},
        {"access_emails": user.email},
    ]
    cursor = db.flight_files.find(query).sort("uploaded_at", -1)
    rows = await cursor.to_list(length=500)
    results: List[FlightDataFileOut] = []
    for row in rows:
        results.append(
            FlightDataFileOut(
                file_id=str(row["_id"]),
                project_id=row["project_id"],
                owner_email=row["owner_email"],
                section=row["section"],
                original_name=row["original_name"],
                storage_key=row["storage_key"],
                size_bytes=row.get("size_bytes"),
                content_type=row.get("content_type"),
                uploaded_at=row["uploaded_at"],
                headers=row.get("headers"),
                access_emails=row.get("access_emails", []),
            )
        )
    return results


class ShareRequest(BaseModel):
    user_email: str = Field(..., description="Email of user to share access with")


@router.post("/{file_id}/share")
async def share_file(
    file_id: str,
    payload: ShareRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """Share a flight data file with another user by email.

    Only the owner can share a file. The provided email must correspond to
    a member of the project. If the user already has access, the
    operation is idempotent.
    """
    db = await get_db()
    doc = await db.flight_files.find_one({"_id": ObjectId(file_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")
    # Check ownership
    if doc["owner_email"] != user.email:
        raise HTTPException(status_code=403, detail="Only the owner can share files")
    # Ensure target is a member of the project
    await _ensure_project_member(db, doc["project_id"], payload.user_email)
    # Idempotently add user to access list
    await db.flight_files.update_one(
        {"_id": ObjectId(file_id)},
        {"$addToSet": {"access_emails": payload.user_email}},
    )
    return {"ok": True}


@router.delete("/{file_id}")
async def delete_file(
    file_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Delete a flight data file and its metadata.

    Only the owner can delete a file. The object will be removed from
    MinIO and the document will be removed from the database. This
    operation is irreversible.
    """
    db = await get_db()
    doc = await db.flight_files.find_one({"_id": ObjectId(file_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")
    if doc["owner_email"] != user.email:
        raise HTTPException(status_code=403, detail="Only the owner can delete files")
    # Delete from storage
    minio_client = get_minio_client()
    bucket = getattr(settings, "minio_flightdata_bucket", settings.minio_docs_bucket)
    minio_client.remove_object(bucket, doc["storage_key"])
    # Remove document
    await db.flight_files.delete_one({"_id": ObjectId(file_id)})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------

@router.get("/{file_id}/download-url")
async def get_download_url(
    file_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Generate a presigned URL for downloading a flight data file.

    Only owners and users with access may request a download URL.
    """
    db = await get_db()
    doc = await db.flight_files.find_one({"_id": ObjectId(file_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")
    # Ensure user has access
    if doc["owner_email"] != user.email and user.email not in doc.get("access_emails", []):
        raise HTTPException(status_code=403, detail="No access to download file")
    minio_client = get_minio_client()
    bucket = getattr(settings, "minio_flightdata_bucket", settings.minio_docs_bucket)
    url = minio_client.presigned_get_object(
        bucket_name=bucket, object_name=doc["storage_key"], expires=timedelta(hours=1)
    )
    return {"download_url": url}
