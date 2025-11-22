from datetime import datetime, timedelta
from uuid import uuid4
from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.core.minio_client import get_minio_client
from app.db.mongo import get_db
from app.models.student_engagement import (
    ApprovalStatus,
    InitEngagementUpload,
    StudentEngagementCreate,
    StudentEngagementOut,
)

router = APIRouter(prefix="/api/student-engagements", tags=["student-engagements"])


async def _ensure_bucket(bucket: str) -> None:
    minio_client = get_minio_client()
    if not minio_client.bucket_exists(bucket):
        minio_client.make_bucket(bucket)


@router.post("/init-upload")
async def init_engagement_upload(
    payload: InitEngagementUpload,
    user: CurrentUser = Depends(get_current_user),
):
    bucket = settings.minio_docs_bucket
    await _ensure_bucket(bucket)

    object_key = (
        f"users/{user.email}/student-engagements/{uuid4()}_{payload.filename}"
    )
    upload_url = get_minio_client().presigned_put_object(
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


@router.post("", response_model=StudentEngagementOut)
async def create_student_engagement(
    payload: StudentEngagementCreate,
    user: CurrentUser = Depends(get_current_user),
):
    db = await get_db()
    now = datetime.utcnow()

    doc = {
        "owner_email": user.email,
        "created_at": now,
        "updated_at": now,
    }

    for key, value in payload.dict().items():
        if hasattr(value, "year") and hasattr(value, "month") and hasattr(value, "day"):
            doc[key] = datetime(value.year, value.month, value.day)
        else:
            doc[key] = value

    res = await db.student_engagements.insert_one(doc)

    return StudentEngagementOut(
        record_id=str(res.inserted_id),
        owner_email=user.email,
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
        **payload.dict(),
    )


@router.get("", response_model=List[StudentEngagementOut])
async def list_student_engagements(
    approval_status: Optional[ApprovalStatus] = Query(None),
    user: CurrentUser = Depends(get_current_user),
):
    db = await get_db()
    query = {"owner_email": user.email}
    if approval_status:
        query["approval_status"] = approval_status.value

    cursor = db.student_engagements.find(query).sort("created_at", -1)
    rows = await cursor.to_list(length=500)

    results: List[StudentEngagementOut] = []
    for row in rows:
        # Convert stored datetimes back to dates for response schema
        payload = {
            "student": row.get("student"),
            "program_name": row.get("program_name"),
            "program_type": row.get("program_type"),
            "duration_months": row.get("duration_months"),
            "start_date": row.get("start_date").date()
            if row.get("start_date")
            else None,
            "end_date": row.get("end_date").date() if row.get("end_date") else None,
            "status": row.get("status"),
            "approval_status": row.get("approval_status", ApprovalStatus.WAITING),
            "notes": row.get("notes"),
            "storage_key": row.get("storage_key"),
            "original_name": row.get("original_name"),
            "content_type": row.get("content_type"),
            "size_bytes": row.get("size_bytes"),
        }
        results.append(
            StudentEngagementOut(
                record_id=str(row["_id"]),
                owner_email=row["owner_email"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                **payload,
            )
        )

    return results
