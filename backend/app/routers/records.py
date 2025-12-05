from datetime import datetime, timedelta
from typing import Any, Dict, List
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Path, status

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.core.minio_client import get_minio_client
from app.db.mongo import get_db
from app.models.records import (
    CustomerFeedbackCreate,
    CustomerFeedbackOut,
    DivisionalRecordCreate,
    DivisionalRecordOut,
    InitRecordUpload,
    RecordSection,
    SupplyOrderCreate,
    SupplyOrderOut,
    TechnicalReportCreate,
    TechnicalReportOut,
    TrainingRecordCreate,
    TrainingRecordOut,
)

router = APIRouter(prefix="/api/records", tags=["records"])


SECTION_TO_MODEL: Dict[RecordSection, Any] = {
    RecordSection.INVENTORY_RECORDS: (SupplyOrderCreate, SupplyOrderOut),
    RecordSection.DIVISIONAL_RECORDS: (DivisionalRecordCreate, DivisionalRecordOut),
    RecordSection.CUSTOMER_FEEDBACKS: (CustomerFeedbackCreate, CustomerFeedbackOut),
    RecordSection.TECHNICAL_REPORTS: (TechnicalReportCreate, TechnicalReportOut),
    RecordSection.TRAINING_RECORDS: (TrainingRecordCreate, TrainingRecordOut),
}


async def _ensure_bucket(bucket: str) -> None:
    minio_client = get_minio_client()
    if not minio_client.bucket_exists(bucket):
        minio_client.make_bucket(bucket)


@router.post("/{section}/init-upload")
async def init_record_upload(
    payload: InitRecordUpload,
    section: RecordSection = Path(..., description="Record section"),
    user: CurrentUser = Depends(get_current_user),
):
    bucket = settings.minio_docs_bucket
    await _ensure_bucket(bucket)

    # prevent duplicate uploads for the same section and user
    db = await get_db()
    existing = await db.records.find_one(
        {
            "section": section.value,
            "owner_email": user.email,
            "content_hash": payload.content_hash,
        }
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Duplicate upload detected for this section.",
        )

    object_key = (
        f"users/{user.email}/records/{section.value}/{uuid4()}_{payload.filename}"
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


async def _insert_record(
    section: RecordSection,
    payload_model,
    payload_data,
    user: CurrentUser,
):
    db = await get_db()
    now = datetime.utcnow()

    doc = {
        "section": section.value,
        "owner_email": user.email,
        "created_at": now,
        "updated_at": now,
    }
    # Convert payload data and normalize date values so Mongo can store them
    normalized_payload = {}
    for key, value in payload_data.items():
        # pymongo cannot encode ``datetime.date`` directly, so convert
        if hasattr(value, "year") and hasattr(value, "month") and hasattr(value, "day"):
            normalized_payload[key] = datetime(value.year, value.month, value.day)
        else:
            normalized_payload[key] = value

    doc.update(normalized_payload)

    res = await db.records.insert_one(doc)
    return str(res.inserted_id), doc


async def _update_record(
    section: RecordSection, record_id: str, payload_model, payload_data, user: CurrentUser
):
    db = await get_db()
    oid = ObjectId(record_id)
    row = await db.records.find_one(
        {"_id": oid, "owner_email": user.email, "section": section.value}
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    now = datetime.utcnow()
    normalized_payload = {}
    for key, value in payload_data.items():
        if hasattr(value, "year") and hasattr(value, "month") and hasattr(value, "day"):
            normalized_payload[key] = datetime(value.year, value.month, value.day)
        else:
            normalized_payload[key] = value

    await db.records.update_one({"_id": oid}, {"$set": {**normalized_payload, "updated_at": now}})
    return row, now


async def _delete_record(section: RecordSection, record_id: str, user: CurrentUser):
    db = await get_db()
    oid = ObjectId(record_id)
    row = await db.records.find_one(
        {"_id": oid, "owner_email": user.email, "section": section.value}
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    if row.get("storage_key"):
        try:
            get_minio_client().remove_object(
                bucket_name=settings.minio_docs_bucket, object_name=row["storage_key"]
            )
        except Exception:
            pass

    await db.records.delete_one({"_id": oid})
    return True


async def _download_url(section: RecordSection, record_id: str, user: CurrentUser):
    db = await get_db()
    oid = ObjectId(record_id)
    row = await db.records.find_one(
        {"_id": oid, "owner_email": user.email, "section": section.value}
    )
    if not row or not row.get("storage_key"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    url = get_minio_client().presigned_get_object(
        bucket_name=settings.minio_docs_bucket,
        object_name=row["storage_key"],
        expires=timedelta(hours=1),
    )
    return {"download_url": url, "original_name": row.get("original_name")}


async def _list_records(section: RecordSection, user: CurrentUser):
    db = await get_db()
    cursor = (
        db.records.find({"section": section.value, "owner_email": user.email})
        .sort("created_at", -1)
        .limit(500)
    )
    return await cursor.to_list(length=500)


@router.post("/inventory-records", response_model=SupplyOrderOut)
async def create_supply_order(
    payload: SupplyOrderCreate,
    user: CurrentUser = Depends(get_current_user),
):
    record_id, doc = await _insert_record(
        RecordSection.INVENTORY_RECORDS, SupplyOrderCreate, payload.dict(), user
    )

    return SupplyOrderOut(
        record_id=record_id,
        owner_email=user.email,
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
        **payload.dict(),
    )


@router.get("/inventory-records", response_model=List[SupplyOrderOut])
async def list_supply_orders(user: CurrentUser = Depends(get_current_user)):
    rows = await _list_records(RecordSection.INVENTORY_RECORDS, user)
    results: List[SupplyOrderOut] = []
    for row in rows:
        results.append(
            SupplyOrderOut(
                record_id=str(row["_id"]),
                owner_email=row["owner_email"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                **{k: row.get(k) for k in SupplyOrderCreate.model_fields.keys()},
            )
        )
    return results


@router.put("/inventory-records/{record_id}", response_model=SupplyOrderOut)
async def update_supply_order(
    record_id: str, payload: SupplyOrderCreate, user: CurrentUser = Depends(get_current_user)
):
    existing, updated_at = await _update_record(
        RecordSection.INVENTORY_RECORDS, record_id, SupplyOrderCreate, payload.dict(), user
    )
    return SupplyOrderOut(
        record_id=record_id,
        owner_email=user.email,
        created_at=existing["created_at"],
        updated_at=updated_at,
        **payload.dict(),
    )


@router.delete("/inventory-records/{record_id}")
async def delete_supply_order(record_id: str, user: CurrentUser = Depends(get_current_user)):
    await _delete_record(RecordSection.INVENTORY_RECORDS, record_id, user)
    return {"ok": True}


@router.get("/inventory-records/{record_id}/download-url")
async def download_supply_order(record_id: str, user: CurrentUser = Depends(get_current_user)):
    return await _download_url(RecordSection.INVENTORY_RECORDS, record_id, user)


@router.post("/divisional-records", response_model=DivisionalRecordOut)
async def create_divisional_record(
    payload: DivisionalRecordCreate,
    user: CurrentUser = Depends(get_current_user),
):
    record_id, doc = await _insert_record(
        RecordSection.DIVISIONAL_RECORDS, DivisionalRecordCreate, payload.dict(), user
    )
    return DivisionalRecordOut(
        record_id=record_id,
        owner_email=user.email,
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
        **payload.dict(),
    )


@router.get("/divisional-records", response_model=List[DivisionalRecordOut])
async def list_divisional_records(user: CurrentUser = Depends(get_current_user)):
    rows = await _list_records(RecordSection.DIVISIONAL_RECORDS, user)
    return [
        DivisionalRecordOut(
            record_id=str(row["_id"]),
            owner_email=row["owner_email"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            **{k: row.get(k) for k in DivisionalRecordCreate.model_fields.keys()},
        )
        for row in rows
    ]


@router.put("/divisional-records/{record_id}", response_model=DivisionalRecordOut)
async def update_divisional_record(
    record_id: str, payload: DivisionalRecordCreate, user: CurrentUser = Depends(get_current_user)
):
    existing, updated_at = await _update_record(
        RecordSection.DIVISIONAL_RECORDS, record_id, DivisionalRecordCreate, payload.dict(), user
    )
    return DivisionalRecordOut(
        record_id=record_id,
        owner_email=user.email,
        created_at=existing["created_at"],
        updated_at=updated_at,
        **payload.dict(),
    )


@router.delete("/divisional-records/{record_id}")
async def delete_divisional_record(record_id: str, user: CurrentUser = Depends(get_current_user)):
    await _delete_record(RecordSection.DIVISIONAL_RECORDS, record_id, user)
    return {"ok": True}


@router.get("/divisional-records/{record_id}/download-url")
async def download_divisional_record(record_id: str, user: CurrentUser = Depends(get_current_user)):
    return await _download_url(RecordSection.DIVISIONAL_RECORDS, record_id, user)


@router.post("/customer-feedbacks", response_model=CustomerFeedbackOut)
async def create_customer_feedback(
    payload: CustomerFeedbackCreate,
    user: CurrentUser = Depends(get_current_user),
):
    record_id, doc = await _insert_record(
        RecordSection.CUSTOMER_FEEDBACKS, CustomerFeedbackCreate, payload.dict(), user
    )
    return CustomerFeedbackOut(
        record_id=record_id,
        owner_email=user.email,
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
        **payload.dict(),
    )


@router.get("/customer-feedbacks", response_model=List[CustomerFeedbackOut])
async def list_customer_feedbacks(user: CurrentUser = Depends(get_current_user)):
    rows = await _list_records(RecordSection.CUSTOMER_FEEDBACKS, user)
    return [
        CustomerFeedbackOut(
            record_id=str(row["_id"]),
            owner_email=row["owner_email"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            **{k: row.get(k) for k in CustomerFeedbackCreate.model_fields.keys()},
        )
        for row in rows
    ]


@router.put("/customer-feedbacks/{record_id}", response_model=CustomerFeedbackOut)
async def update_customer_feedback(
    record_id: str, payload: CustomerFeedbackCreate, user: CurrentUser = Depends(get_current_user)
):
    existing, updated_at = await _update_record(
        RecordSection.CUSTOMER_FEEDBACKS, record_id, CustomerFeedbackCreate, payload.dict(), user
    )
    return CustomerFeedbackOut(
        record_id=record_id,
        owner_email=user.email,
        created_at=existing["created_at"],
        updated_at=updated_at,
        **payload.dict(),
    )


@router.delete("/customer-feedbacks/{record_id}")
async def delete_customer_feedback(record_id: str, user: CurrentUser = Depends(get_current_user)):
    await _delete_record(RecordSection.CUSTOMER_FEEDBACKS, record_id, user)
    return {"ok": True}


@router.get("/customer-feedbacks/{record_id}/download-url")
async def download_customer_feedback(record_id: str, user: CurrentUser = Depends(get_current_user)):
    return await _download_url(RecordSection.CUSTOMER_FEEDBACKS, record_id, user)


@router.post("/technical-reports", response_model=TechnicalReportOut)
async def create_technical_report(
    payload: TechnicalReportCreate,
    user: CurrentUser = Depends(get_current_user),
):
    record_id, doc = await _insert_record(
        RecordSection.TECHNICAL_REPORTS, TechnicalReportCreate, payload.dict(), user
    )
    return TechnicalReportOut(
        record_id=record_id,
        owner_email=user.email,
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
        **payload.dict(),
    )


@router.get("/technical-reports", response_model=List[TechnicalReportOut])
async def list_technical_reports(user: CurrentUser = Depends(get_current_user)):
    rows = await _list_records(RecordSection.TECHNICAL_REPORTS, user)
    return [
        TechnicalReportOut(
            record_id=str(row["_id"]),
            owner_email=row["owner_email"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            **{k: row.get(k) for k in TechnicalReportCreate.model_fields.keys()},
        )
        for row in rows
    ]


@router.put("/technical-reports/{record_id}", response_model=TechnicalReportOut)
async def update_technical_report(
    record_id: str, payload: TechnicalReportCreate, user: CurrentUser = Depends(get_current_user)
):
    existing, updated_at = await _update_record(
        RecordSection.TECHNICAL_REPORTS, record_id, TechnicalReportCreate, payload.dict(), user
    )
    return TechnicalReportOut(
        record_id=record_id,
        owner_email=user.email,
        created_at=existing["created_at"],
        updated_at=updated_at,
        **payload.dict(),
    )


@router.delete("/technical-reports/{record_id}")
async def delete_technical_report(record_id: str, user: CurrentUser = Depends(get_current_user)):
    await _delete_record(RecordSection.TECHNICAL_REPORTS, record_id, user)
    return {"ok": True}


@router.get("/technical-reports/{record_id}/download-url")
async def download_technical_report(record_id: str, user: CurrentUser = Depends(get_current_user)):
    return await _download_url(RecordSection.TECHNICAL_REPORTS, record_id, user)


@router.post("/training-records", response_model=TrainingRecordOut)
async def create_training_record(
    payload: TrainingRecordCreate,
    user: CurrentUser = Depends(get_current_user),
):
    record_id, doc = await _insert_record(
        RecordSection.TRAINING_RECORDS, TrainingRecordCreate, payload.dict(), user
    )
    return TrainingRecordOut(
        record_id=record_id,
        owner_email=user.email,
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
        **payload.dict(),
    )


@router.get("/training-records", response_model=List[TrainingRecordOut])
async def list_training_records(user: CurrentUser = Depends(get_current_user)):
    rows = await _list_records(RecordSection.TRAINING_RECORDS, user)
    return [
        TrainingRecordOut(
            record_id=str(row["_id"]),
            owner_email=row["owner_email"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            **{k: row.get(k) for k in TrainingRecordCreate.model_fields.keys()},
        )
        for row in rows
    ]


@router.put("/training-records/{record_id}", response_model=TrainingRecordOut)
async def update_training_record(
    record_id: str, payload: TrainingRecordCreate, user: CurrentUser = Depends(get_current_user)
):
    existing, updated_at = await _update_record(
        RecordSection.TRAINING_RECORDS, record_id, TrainingRecordCreate, payload.dict(), user
    )
    return TrainingRecordOut(
        record_id=record_id,
        owner_email=user.email,
        created_at=existing["created_at"],
        updated_at=updated_at,
        **payload.dict(),
    )


@router.delete("/training-records/{record_id}")
async def delete_training_record(record_id: str, user: CurrentUser = Depends(get_current_user)):
    await _delete_record(RecordSection.TRAINING_RECORDS, record_id, user)
    return {"ok": True}


@router.get("/training-records/{record_id}/download-url")
async def download_training_record(record_id: str, user: CurrentUser = Depends(get_current_user)):
    return await _download_url(RecordSection.TRAINING_RECORDS, record_id, user)
