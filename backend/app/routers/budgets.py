from datetime import datetime, timedelta
from typing import List
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.core.minio_client import get_minio_client
from app.db.mongo import get_db
from app.models.budget import BudgetForecastCreate, BudgetForecastOut

router = APIRouter(prefix="/api/budget-forecasts", tags=["budget-forecasts"])


async def _ensure_bucket(bucket: str) -> None:
    minio_client = get_minio_client()
    if not minio_client.bucket_exists(bucket):
        minio_client.make_bucket(bucket)


def _normalize_payload(payload: dict) -> dict:
    normalized = {}
    for key, value in payload.items():
        if hasattr(value, "year") and hasattr(value, "month") and hasattr(value, "day"):
            normalized[key] = datetime(value.year, value.month, value.day)
        else:
            normalized[key] = value
    return normalized


def _merge_payload(existing: dict, payload: BudgetForecastCreate) -> dict:
    merged = {k: existing.get(k) for k in BudgetForecastCreate.model_fields.keys()}
    merged.update(payload.model_dump(exclude_none=True))
    return merged


def _serialize_record(row: dict) -> BudgetForecastOut:
    payload = {k: row.get(k) for k in BudgetForecastCreate.model_fields.keys()}
    return BudgetForecastOut(
        record_id=str(row["_id"]),
        owner_email=row["owner_email"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        **payload,
    )


@router.post("/init-upload")
async def init_upload(payload: BudgetForecastCreate, user: CurrentUser = Depends(get_current_user)):
    bucket = settings.minio_docs_bucket
    await _ensure_bucket(bucket)

    if not payload.original_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="original_name is required to start an upload",
        )

    object_key = f"users/{user.email}/budget-forecasts/{uuid4()}_{payload.original_name}"

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


@router.get("", response_model=List[BudgetForecastOut])
async def list_forecasts(user: CurrentUser = Depends(get_current_user)):
    db = await get_db()
    cursor = (
        db.budget_forecasts.find({"owner_email": user.email}).sort("created_at", -1).limit(500)
    )
    rows = await cursor.to_list(length=500)
    return [_serialize_record(row) for row in rows]


@router.post("", response_model=BudgetForecastOut)
async def create_forecast(
    payload: BudgetForecastCreate, user: CurrentUser = Depends(get_current_user)
):
    db = await get_db()
    now = datetime.utcnow()
    body = {
        "owner_email": user.email,
        "created_at": now,
        "updated_at": now,
        **_normalize_payload(payload.model_dump(exclude_none=True)),
    }
    res = await db.budget_forecasts.insert_one(body)
    return BudgetForecastOut(record_id=str(res.inserted_id), **body)


@router.put("/{record_id}", response_model=BudgetForecastOut)
async def update_forecast(
    record_id: str,
    payload: BudgetForecastCreate,
    user: CurrentUser = Depends(get_current_user),
):
    db = await get_db()
    oid = ObjectId(record_id)
    existing = await db.budget_forecasts.find_one({"_id": oid, "owner_email": user.email})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Forecast not found")

    now = datetime.utcnow()
    normalized = _normalize_payload(payload.model_dump(exclude_none=True))
    await db.budget_forecasts.update_one(
        {"_id": oid},
        {"$set": {**normalized, "updated_at": now}},
    )

    merged = _merge_payload(existing, payload)
    return BudgetForecastOut(
        record_id=record_id,
        owner_email=user.email,
        created_at=existing["created_at"],
        updated_at=now,
        **merged,
    )


@router.delete("/{record_id}")
async def delete_forecast(record_id: str, user: CurrentUser = Depends(get_current_user)):
    db = await get_db()
    oid = ObjectId(record_id)
    existing = await db.budget_forecasts.find_one({"_id": oid, "owner_email": user.email})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Forecast not found")

    if existing.get("storage_key"):
        try:
            get_minio_client().remove_object(
                bucket_name=settings.minio_docs_bucket, object_name=existing["storage_key"]
            )
        except Exception:
            pass

    await db.budget_forecasts.delete_one({"_id": oid})
    return {"ok": True}


@router.get("/{record_id}/download-url")
async def download_forecast(record_id: str, user: CurrentUser = Depends(get_current_user)):
    db = await get_db()
    oid = ObjectId(record_id)
    row = await db.budget_forecasts.find_one({"_id": oid, "owner_email": user.email})
    if not row or not row.get("storage_key"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    url = get_minio_client().presigned_get_object(
        bucket_name=settings.minio_docs_bucket,
        object_name=row["storage_key"],
        expires=timedelta(hours=1),
    )
    return {"download_url": url, "original_name": row.get("original_name")}
