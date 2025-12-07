from typing import Dict, List

from fastapi import APIRouter, Depends, Path

from app.core.auth import CurrentUser, get_current_user
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
from app.services.records_service import RecordMeta, RecordsService

router = APIRouter(prefix="/api/records", tags=["records"])
records_service = RecordsService()

def _build_response(meta: RecordMeta, payload: Dict, out_model):
    return out_model(
        record_id=meta.record_id,
        owner_email=meta.owner_email,
        created_at=meta.created_at,
        updated_at=meta.updated_at,
        **payload,
    )


def _serialize_row(row: dict, create_model, out_model):
    row_data = {k: row.get(k) for k in create_model.model_fields.keys()}
    if row_data.get("pl_holder") is None and row.get("holder"):
        row_data["pl_holder"] = row.get("holder")
    return out_model(
        record_id=str(row["_id"]),
        owner_email=row["owner_email"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        **row_data,
    )


@router.post("/{section}/init-upload")
async def init_record_upload(
    payload: InitRecordUpload,
    section: RecordSection = Path(..., description="Record section"),
    user: CurrentUser = Depends(get_current_user),
):
    return await records_service.init_upload(section, payload, user)


@router.post("/inventory-records", response_model=SupplyOrderOut)
async def create_supply_order(
    payload: SupplyOrderCreate,
    user: CurrentUser = Depends(get_current_user),
):
    meta = await records_service.create_record(
        RecordSection.INVENTORY_RECORDS,
        payload.model_dump(exclude_none=True),
        user,
    )
    return _build_response(meta, payload.model_dump(), SupplyOrderOut)


@router.get("/inventory-records", response_model=List[SupplyOrderOut])
async def list_supply_orders(user: CurrentUser = Depends(get_current_user)):
    rows = await records_service.list_records(RecordSection.INVENTORY_RECORDS, user)
    return [
        _serialize_row(row, SupplyOrderCreate, SupplyOrderOut)
        for row in rows
    ]


@router.put("/inventory-records/{record_id}", response_model=SupplyOrderOut)
async def update_supply_order(
    record_id: str, payload: SupplyOrderCreate, user: CurrentUser = Depends(get_current_user)
):
    meta = await records_service.update_record(
        RecordSection.INVENTORY_RECORDS,
        record_id,
        payload.model_dump(exclude_none=True),
        SupplyOrderCreate.model_fields.keys(),
        user,
    )
    return _build_response(meta, meta.payload, SupplyOrderOut)


@router.delete("/inventory-records/{record_id}")
async def delete_supply_order(record_id: str, user: CurrentUser = Depends(get_current_user)):
    await records_service.delete_record(RecordSection.INVENTORY_RECORDS, record_id, user)
    return {"ok": True}


@router.get("/inventory-records/{record_id}/download-url")
async def download_supply_order(record_id: str, user: CurrentUser = Depends(get_current_user)):
    return await records_service.download_url(RecordSection.INVENTORY_RECORDS, record_id, user)


@router.post("/divisional-records", response_model=DivisionalRecordOut)
async def create_divisional_record(
    payload: DivisionalRecordCreate,
    user: CurrentUser = Depends(get_current_user),
):
    meta = await records_service.create_record(
        RecordSection.DIVISIONAL_RECORDS,
        payload.model_dump(exclude_none=True),
        user,
    )
    return _build_response(meta, payload.model_dump(), DivisionalRecordOut)


@router.get("/divisional-records", response_model=List[DivisionalRecordOut])
async def list_divisional_records(user: CurrentUser = Depends(get_current_user)):
    rows = await records_service.list_records(RecordSection.DIVISIONAL_RECORDS, user)
    return [
        _serialize_row(row, DivisionalRecordCreate, DivisionalRecordOut)
        for row in rows
    ]


@router.put("/divisional-records/{record_id}", response_model=DivisionalRecordOut)
async def update_divisional_record(
    record_id: str, payload: DivisionalRecordCreate, user: CurrentUser = Depends(get_current_user)
):
    meta = await records_service.update_record(
        RecordSection.DIVISIONAL_RECORDS,
        record_id,
        payload.model_dump(exclude_none=True),
        DivisionalRecordCreate.model_fields.keys(),
        user,
    )
    return _build_response(meta, meta.payload, DivisionalRecordOut)


@router.delete("/divisional-records/{record_id}")
async def delete_divisional_record(record_id: str, user: CurrentUser = Depends(get_current_user)):
    await records_service.delete_record(RecordSection.DIVISIONAL_RECORDS, record_id, user)
    return {"ok": True}


@router.get("/divisional-records/{record_id}/download-url")
async def download_divisional_record(record_id: str, user: CurrentUser = Depends(get_current_user)):
    return await records_service.download_url(RecordSection.DIVISIONAL_RECORDS, record_id, user)


@router.post("/customer-feedbacks", response_model=CustomerFeedbackOut)
async def create_customer_feedback(
    payload: CustomerFeedbackCreate,
    user: CurrentUser = Depends(get_current_user),
):
    meta = await records_service.create_record(
        RecordSection.CUSTOMER_FEEDBACKS,
        payload.model_dump(exclude_none=True),
        user,
    )
    return _build_response(meta, payload.model_dump(), CustomerFeedbackOut)


@router.get("/customer-feedbacks", response_model=List[CustomerFeedbackOut])
async def list_customer_feedbacks(user: CurrentUser = Depends(get_current_user)):
    rows = await records_service.list_records(RecordSection.CUSTOMER_FEEDBACKS, user)
    return [
        _serialize_row(row, CustomerFeedbackCreate, CustomerFeedbackOut)
        for row in rows
    ]


@router.put("/customer-feedbacks/{record_id}", response_model=CustomerFeedbackOut)
async def update_customer_feedback(
    record_id: str, payload: CustomerFeedbackCreate, user: CurrentUser = Depends(get_current_user)
):
    meta = await records_service.update_record(
        RecordSection.CUSTOMER_FEEDBACKS,
        record_id,
        payload.model_dump(exclude_none=True),
        CustomerFeedbackCreate.model_fields.keys(),
        user,
    )
    return _build_response(meta, meta.payload, CustomerFeedbackOut)


@router.delete("/customer-feedbacks/{record_id}")
async def delete_customer_feedback(record_id: str, user: CurrentUser = Depends(get_current_user)):
    await records_service.delete_record(RecordSection.CUSTOMER_FEEDBACKS, record_id, user)
    return {"ok": True}


@router.get("/customer-feedbacks/{record_id}/download-url")
async def download_customer_feedback(record_id: str, user: CurrentUser = Depends(get_current_user)):
    return await records_service.download_url(RecordSection.CUSTOMER_FEEDBACKS, record_id, user)


@router.post("/technical-reports", response_model=TechnicalReportOut)
async def create_technical_report(
    payload: TechnicalReportCreate,
    user: CurrentUser = Depends(get_current_user),
):
    meta = await records_service.create_record(
        RecordSection.TECHNICAL_REPORTS,
        payload.model_dump(exclude_none=True),
        user,
    )
    return _build_response(meta, payload.model_dump(), TechnicalReportOut)


@router.get("/technical-reports", response_model=List[TechnicalReportOut])
async def list_technical_reports(user: CurrentUser = Depends(get_current_user)):
    rows = await records_service.list_records(RecordSection.TECHNICAL_REPORTS, user)
    return [
        _serialize_row(row, TechnicalReportCreate, TechnicalReportOut)
        for row in rows
    ]


@router.put("/technical-reports/{record_id}", response_model=TechnicalReportOut)
async def update_technical_report(
    record_id: str, payload: TechnicalReportCreate, user: CurrentUser = Depends(get_current_user)
):
    meta = await records_service.update_record(
        RecordSection.TECHNICAL_REPORTS,
        record_id,
        payload.model_dump(exclude_none=True),
        TechnicalReportCreate.model_fields.keys(),
        user,
    )
    return _build_response(meta, meta.payload, TechnicalReportOut)


@router.delete("/technical-reports/{record_id}")
async def delete_technical_report(record_id: str, user: CurrentUser = Depends(get_current_user)):
    await records_service.delete_record(RecordSection.TECHNICAL_REPORTS, record_id, user)
    return {"ok": True}


@router.get("/technical-reports/{record_id}/download-url")
async def download_technical_report(record_id: str, user: CurrentUser = Depends(get_current_user)):
    return await records_service.download_url(RecordSection.TECHNICAL_REPORTS, record_id, user)


@router.post("/training-records", response_model=TrainingRecordOut)
async def create_training_record(
    payload: TrainingRecordCreate,
    user: CurrentUser = Depends(get_current_user),
):
    meta = await records_service.create_record(
        RecordSection.TRAINING_RECORDS,
        payload.model_dump(exclude_none=True),
        user,
    )
    return _build_response(meta, payload.model_dump(), TrainingRecordOut)


@router.get("/training-records", response_model=List[TrainingRecordOut])
async def list_training_records(user: CurrentUser = Depends(get_current_user)):
    rows = await records_service.list_records(RecordSection.TRAINING_RECORDS, user)
    return [
        _serialize_row(row, TrainingRecordCreate, TrainingRecordOut)
        for row in rows
    ]


@router.put("/training-records/{record_id}", response_model=TrainingRecordOut)
async def update_training_record(
    record_id: str, payload: TrainingRecordCreate, user: CurrentUser = Depends(get_current_user)
):
    meta = await records_service.update_record(
        RecordSection.TRAINING_RECORDS,
        record_id,
        payload.model_dump(exclude_none=True),
        TrainingRecordCreate.model_fields.keys(),
        user,
    )
    return _build_response(meta, meta.payload, TrainingRecordOut)


@router.delete("/training-records/{record_id}")
async def delete_training_record(record_id: str, user: CurrentUser = Depends(get_current_user)):
    await records_service.delete_record(RecordSection.TRAINING_RECORDS, record_id, user)
    return {"ok": True}


@router.get("/training-records/{record_id}/download-url")
async def download_training_record(record_id: str, user: CurrentUser = Depends(get_current_user)):
    return await records_service.download_url(RecordSection.TRAINING_RECORDS, record_id, user)
