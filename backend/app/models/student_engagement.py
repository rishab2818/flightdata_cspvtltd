from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, validator


class ApprovalStatus(str, Enum):
    APPROVED = "approved"
    WAITING = "waiting"


class StudentEngagementCreate(BaseModel):
    student: str
    college_name: str
    project_name: str
    program_type: str
    duration_months: int = Field(..., ge=1)
    start_date: date
    end_date: date
    mentor: Optional[str] = None
    status: str
    approval_status: ApprovalStatus = ApprovalStatus.WAITING
    notes: Optional[str] = None
    storage_key: Optional[str] = None
    original_name: Optional[str] = None
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None
    content_hash: Optional[str] = Field(
        None, description="Hash of the uploaded file to avoid duplicate uploads"
    )

    @validator("end_date")
    def validate_end_date(cls, v, values):
        start_date = values.get("start_date")
        if start_date and v < start_date:
            raise ValueError("end_date cannot be before start_date")
        return v


class StudentEngagementOut(StudentEngagementCreate):
    record_id: str
    owner_email: str
    created_at: datetime
    updated_at: datetime


class InitEngagementUpload(BaseModel):
    filename: str
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None
    content_hash: str = Field(..., min_length=32)
