from datetime import datetime, timedelta
from uuid import uuid4
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user, CurrentUser
from app.core.minio_client import get_minio_client
from app.core.config import settings
from app.db.mongo import get_db
from app.models.documents import (
    ActionPoint,
    DocumentSection,
    MoMSubsection,
    DocumentInitUpload,
    DocumentConfirm,
    UserDocumentOut,
)

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _validate_section_and_subsection(
    section: DocumentSection, subsection: Optional[MoMSubsection]
) -> None:
    if section == DocumentSection.MINUTES_OF_MEETING and subsection is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="subsection is required when section is minutes_of_meeting",
        )
    if section != DocumentSection.MINUTES_OF_MEETING and subsection is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="subsection is only allowed for minutes_of_meeting section",
        )


# ---------- 1) Init upload: get presigned URL, dedupe check ----------
@router.post("/init-upload")
async def init_document_upload(
    payload: DocumentInitUpload,
    user: CurrentUser = Depends(get_current_user),
):
    """Return a presigned URL to upload a file directly to MinIO.

    Also enforces dedupe per user+content_hash before issuing URL.
    """
    _validate_section_and_subsection(payload.section, payload.subsection)

    db = await get_db()

    # Dedupe: same user + same content hash => reject
    existing = await db.user_documents.find_one(
        {
            "owner_email": user.email,
            "content_hash": payload.content_hash,
        }
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Duplicate document: this file already exists for this user.",
        )

    minio_client = get_minio_client()
    bucket = settings.minio_docs_bucket

    # Construct object key under users/<email>/<section>/<subsection?>/
    key_parts = ["users", user.email, payload.section.value]
    if payload.section == DocumentSection.MINUTES_OF_MEETING:
        key_parts.append(payload.subsection.value)  # type: ignore[arg-type]
    object_prefix = "/".join(key_parts)
    object_key = f"{object_prefix}/{uuid4()}_{payload.filename}"

    try:
        # Ensure bucket exists (idempotent)
        if not minio_client.bucket_exists(bucket):
            minio_client.make_bucket(bucket)

        upload_url = minio_client.presigned_put_object(
            bucket_name=bucket,
            object_name=object_key,
            expires=timedelta(hours=1),
        )
    except Exception as exc:  # pragma: no cover - network dependent
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Storage backend is unavailable. Please try again later.",
        ) from exc

    lan_ip = settings.minio_endpoint.split(":")[0]  # Extract IP from "192.168.1.4:9000"
    upload_url = upload_url.replace("127.0.0.1", lan_ip)
    upload_url = upload_url.replace("localhost", lan_ip)



    return {
        "upload_url": upload_url,
        "storage_key": object_key,
        "bucket": bucket,
        "expires_in": 3600,
    }




# ---------- 2) Confirm upload: register metadata (UPLOAD API) ----------
@router.post("/confirm", response_model=UserDocumentOut)
async def confirm_document_upload(
    payload: DocumentConfirm,
    user: CurrentUser = Depends(get_current_user),
):
    """Register a document after it has been uploaded to MinIO.

    This is the 'Upload' feature: stores tag, date, section, and storage key.
    """
    _validate_section_and_subsection(payload.section, payload.subsection)

    db = await get_db()

    # Dedupe again to be safe in case init-upload was skipped
    existing = await db.user_documents.find_one(
        {
            "owner_email": user.email,
            "content_hash": payload.content_hash,
        }
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Duplicate document: this file already exists for this user.",
        )

    now = datetime.utcnow()

    doc = {
        "owner_email": user.email,
        "section": payload.section.value,
        "subsection": payload.subsection.value if payload.subsection else None,
        "tag": payload.tag,
        "doc_date": datetime(
            payload.doc_date.year, payload.doc_date.month, payload.doc_date.day
        ),
        "original_name": payload.original_name,
        "storage_key": payload.storage_key,
        "content_type": payload.content_type,
        "size_bytes": payload.size_bytes,
        "content_hash": payload.content_hash,
        "uploaded_at": now,
        "action_points": [ap.model_dump() for ap in payload.action_points],
        "action_on": payload.action_on or [],
    }

    res = await db.user_documents.insert_one(doc)
    doc_id = str(res.inserted_id)

    return UserDocumentOut(
        doc_id=doc_id,
        owner_email=doc["owner_email"],
        section=doc["section"],
        subsection=doc["subsection"],
        tag=doc["tag"],
        doc_date=payload.doc_date,
        original_name=doc["original_name"],
        storage_key=doc["storage_key"],
        size_bytes=doc["size_bytes"],
        content_type=doc["content_type"],
        uploaded_at=now,
        action_points=payload.action_points,
        action_on=payload.action_on or [],
    )


# ---------- 3) List documents by section (ONLY own docs) ----------
@router.get("", response_model=List[UserDocumentOut])
async def list_user_documents(
    section: DocumentSection = Query(...),
    subsection: Optional[MoMSubsection] = Query(
        None,
        description="Optional; only valid for minutes_of_meeting. If omitted, returns all MoM subsections.",
    ),
    user: CurrentUser = Depends(get_current_user),
):
    """List all documents of the current user for a given section (and optional subsection)."""

    if section != DocumentSection.MINUTES_OF_MEETING and subsection is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="subsection is only allowed for minutes_of_meeting section",
        )

    db = await get_db()

    query = {
        "owner_email": user.email,
        "section": section.value,
    }
    if section == DocumentSection.MINUTES_OF_MEETING and subsection is not None:
        query["subsection"] = subsection.value

    cursor = db.user_documents.find(query).sort("uploaded_at", -1)
    rows = await cursor.to_list(length=500)

    results: List[UserDocumentOut] = []
    for row in rows:
        results.append(
            UserDocumentOut(
                doc_id=str(row["_id"]),
                owner_email=row["owner_email"],
                section=row["section"],
                subsection=row.get("subsection"),
                tag=row["tag"],
                doc_date=row["doc_date"].date(),
                original_name=row["original_name"],
                storage_key=row["storage_key"],
                size_bytes=row.get("size_bytes"),
                content_type=row.get("content_type"),
                uploaded_at=row["uploaded_at"],
                action_points=[
                    ActionPoint(**ap)
                    for ap in row.get("action_points", [])
                    if ap
                ],
                action_on=row.get("action_on", []),
            )
        )
    return results


# ---------- 3b) Suggest assignees from existing MoM docs ----------
@router.get("/assignees")
async def search_assignees(
    q: str = Query(..., min_length=1, description="Name filter"),
    limit: int = Query(10, ge=1, le=50),
    user: CurrentUser = Depends(get_current_user),
):
    """Return distinct assignee names from the user's MoM documents."""

    db = await get_db()
    cursor = db.user_documents.find(
        {"owner_email": user.email, "section": DocumentSection.MINUTES_OF_MEETING.value},
        {"action_on": 1, "action_points": 1},
    )
    docs = await cursor.to_list(length=500)

    q_lower = q.lower()
    names: List[str] = []
    seen = set()

    for row in docs:
        for name in row.get("action_on", []) or []:
            if isinstance(name, str) and q_lower in name.lower() and name not in seen:
                seen.add(name)
                names.append(name)

        for ap in row.get("action_points", []) or []:
            assignee = ap.get("assigned_to") if isinstance(ap, dict) else None
            if (
                isinstance(assignee, str)
                and assignee
                and q_lower in assignee.lower()
                and assignee not in seen
            ):
                seen.add(assignee)
                names.append(assignee)

        if len(names) >= limit:
            break

    return names[:limit]


# ---------- 4) Download: get presigned GET URL ----------
@router.get("/{doc_id}/download-url")
async def get_document_download_url(
    doc_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Return a presigned URL to download a document the user owns."""

    db = await get_db()
    row = await db.user_documents.find_one(
        {
            "_id": ObjectId(doc_id),
            "owner_email": user.email,
        }
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )

    minio_client = get_minio_client()
    bucket = settings.minio_docs_bucket
    object_key = row["storage_key"]

    download_url = minio_client.presigned_get_object(
        bucket_name=bucket,
        object_name=object_key,
        expires=timedelta(hours=1),
    )

    return {
        "download_url": download_url,
        "original_name": row["original_name"],
        "content_type": row.get("content_type"),
        "expires_in": 3600,
    }


# ---------- 5) Delete (hard delete) ----------
@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Delete a document completely (MinIO object + metadata).

    Only the owner can delete it.
    """

    db = await get_db()
    row = await db.user_documents.find_one(
        {
            "_id": ObjectId(doc_id),
            "owner_email": user.email,
        }
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )

    minio_client = get_minio_client()
    bucket = settings.minio_docs_bucket
    object_key = row["storage_key"]

    # Try to delete from MinIO first; if it fails, still remove metadata
    try:
        minio_client.remove_object(bucket_name=bucket, object_name=object_key)
    except Exception:
        pass

    await db.user_documents.delete_one({"_id": row["_id"]})

    return {"ok": True}
