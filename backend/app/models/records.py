from datetime import date, datetime
from enum import Enum
from typing import List, Optional

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
    content_hash: Optional[str] = Field(
        None, description="Hash of the uploaded file to prevent duplicates"
    )


class QuantityAssignee(BaseModel):
    items: int = Field(..., ge=1, description="Number of items assigned")
    assignee: str = Field(..., min_length=1, description="Assigned to")


class SupplyOrderCreate(BaseRecordFile):
    so_number: Optional[str] = Field(None, description="Supply order number")
    particular: Optional[str] = None
    supplier_name: Optional[str] = None
    quantity: Optional[int] = Field(None, ge=1)
    duration_months: Optional[int] = Field(None, ge=1)
    start_date: Optional[date] = None
    delivery_date: Optional[date] = None
    duty_officer: Optional[str] = None
    pl_holder: Optional[str] = Field(
        None, description="Project lead holder for the supply order"
    )
    pl_ppl_number: Optional[str] = Field(
        None, description="PL or PPL number associated with the order"
    )
    quantity_assignees: Optional[List[QuantityAssignee]] = Field(
        default=None, description="Breakdown of quantity by assignee"
    )
    amount: Optional[float] = Field(None, ge=0)
    status: Optional[str] = Field("Ongoing", description="Program status")

    @validator("delivery_date")
    def validate_delivery(cls, v, values):
        start_date = values.get("start_date")
        if start_date and v < start_date:
            raise ValueError("delivery_date cannot be before start_date")
        return v

    @validator("quantity_assignees")
    def validate_assignees(cls, v, values):
        if v is None:
            return v

        total_assigned = sum(item.items for item in v)
        quantity = values.get("quantity")
        if quantity is not None and total_assigned > quantity:
            raise ValueError("Assigned quantity cannot exceed total quantity")
        return v


class SupplyOrderOut(SupplyOrderCreate):
    record_id: str
    owner_email: str
    created_at: datetime
    updated_at: datetime
    section: RecordSection = RecordSection.INVENTORY_RECORDS


class DivisionalRecordCreate(BaseRecordFile):
    project_id: Optional[str] = None
    division_name: Optional[str] = None
    record_type: Optional[str] = None
    created_date: Optional[date] = None
    rating: Optional[float] = Field(None, ge=0)
    remarks: Optional[str] = None


class DivisionalRecordOut(DivisionalRecordCreate):
    record_id: str
    owner_email: str
    created_at: datetime
    updated_at: datetime
    section: RecordSection = RecordSection.DIVISIONAL_RECORDS


class CustomerFeedbackCreate(BaseRecordFile):
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    division: Optional[str] = None
    feedback_from: Optional[str] = None
    rating: Optional[float] = Field(None, ge=0)
    feedback_date: Optional[date] = None
    feedback_text: Optional[str] = None


class CustomerFeedbackOut(CustomerFeedbackCreate):
    record_id: str
    owner_email: str
    created_at: datetime
    updated_at: datetime
    section: RecordSection = RecordSection.CUSTOMER_FEEDBACKS


class TechnicalReportCreate(BaseRecordFile):
    project_id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    report_type: Optional[str] = None
    created_date: Optional[date] = None
    # rating: Optional[float] = Field(0, ge=0)


class TechnicalReportOut(TechnicalReportCreate):
    record_id: str
    owner_email: str
    created_at: datetime
    updated_at: datetime
    section: RecordSection = RecordSection.TECHNICAL_REPORTS


class TrainingRecordCreate(BaseRecordFile):
    project_id: Optional[str] = None
    trainee_name: Optional[str] = None
    training_name: Optional[str] = None
    training_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    remarks: Optional[str] = None

    @validator("end_date")
    def validate_end_date(cls, v, values):
        start_date = values.get("start_date")
        if start_date and v and v < start_date:
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
