from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, validator


class RecordSection(str, Enum):
    INVENTORY_RECORDS = "inventory-records"
    DIVISIONAL_RECORDS = "divisional-records"
    CUSTOMER_FEEDBACKS = "customer-feedbacks"
    TECHNICAL_REPORTS = "technical-reports"
    TRAINING_RECORDS = "training-records"


class BaseRecordFile(BaseModel):
    storage_key: Optional[str] = Field(None, description="Object key in storage")
    original_name: Optional[str] = None
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None


class SupplyOrderCreate(BaseRecordFile):
    so_number: str = Field(..., description="Supply order number")
    particular: str
    supplier_name: str
    quantity: int = Field(..., ge=1)
    duration_months: int = Field(..., ge=1)
    start_date: date
    delivery_date: date
    duty_officer: str
    holder: str
    amount: float = Field(..., ge=0)
    status: str = Field("Ongoing", description="Program status")

    @validator("delivery_date")
    def validate_delivery(cls, v, values):
        start_date = values.get("start_date")
        if start_date and v < start_date:
            raise ValueError("delivery_date cannot be before start_date")
        return v


class SupplyOrderOut(SupplyOrderCreate):
    record_id: str
    owner_email: str
    created_at: datetime
    updated_at: datetime
    section: RecordSection = RecordSection.INVENTORY_RECORDS


class DivisionalRecordCreate(BaseRecordFile):
    division_name: str
    record_type: str
    created_date: date
    rating: float = Field(..., ge=0)
    remarks: str


class DivisionalRecordOut(DivisionalRecordCreate):
    record_id: str
    owner_email: str
    created_at: datetime
    updated_at: datetime
    section: RecordSection = RecordSection.DIVISIONAL_RECORDS


class CustomerFeedbackCreate(BaseRecordFile):
    project_name: str
    division: str
    feedback_from: str
    rating: float = Field(..., ge=0)
    feedback_date: date
    feedback_text: str


class CustomerFeedbackOut(CustomerFeedbackCreate):
    record_id: str
    owner_email: str
    created_at: datetime
    updated_at: datetime
    section: RecordSection = RecordSection.CUSTOMER_FEEDBACKS


class TechnicalReportCreate(BaseRecordFile):
    name: str
    description: str
    report_type: str
    created_date: date
    rating: float = Field(0, ge=0)


class TechnicalReportOut(TechnicalReportCreate):
    record_id: str
    owner_email: str
    created_at: datetime
    updated_at: datetime
    section: RecordSection = RecordSection.TECHNICAL_REPORTS


class TrainingRecordCreate(BaseRecordFile):
    trainee_name: str
    training_name: str
    training_type: str
    start_date: date
    end_date: date
    status: str
    remarks: Optional[str] = None

    @validator("end_date")
    def validate_end_date(cls, v, values):
        start_date = values.get("start_date")
        if start_date and v < start_date:
            raise ValueError("end_date cannot be before start_date")
        return v


class TrainingRecordOut(TrainingRecordCreate):
    record_id: str
    owner_email: str
    created_at: datetime
    updated_at: datetime
    section: RecordSection = RecordSection.TRAINING_RECORDS


class InitRecordUpload(BaseModel):
    filename: str
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None
    content_hash: str = Field(..., min_length=32)
