from datetime import datetime, timedelta
from typing import Any, Dict, List
from uuid import uuid4

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
                **{k: row.get(k) for k in SupplyOrderCreate.__fields__.keys()},
            )
        )
    return results


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
            **{k: row.get(k) for k in DivisionalRecordCreate.__fields__.keys()},
        )
        for row in rows
    ]


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
            **{k: row.get(k) for k in CustomerFeedbackCreate.__fields__.keys()},
        )
        for row in rows
    ]


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
            **{k: row.get(k) for k in TechnicalReportCreate.__fields__.keys()},
        )
        for row in rows
    ]


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
            **{k: row.get(k) for k in TrainingRecordCreate.__fields__.keys()},
        )
        for row in rows
    ]
