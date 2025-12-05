from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, validator


class ApprovalStatus(str, Enum):
    APPROVED = "approved"
    WAITING = "waiting"


class StudentEngagementCreate(BaseModel):
    student: Optional[str] = None
    college_name: Optional[str] = None
    project_name: Optional[str] = None
    program_type: Optional[str] = None
    duration_months: Optional[int] = Field(None, ge=1)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    mentor: Optional[str] = None
    status: Optional[str] = None
    approval_status: Optional[ApprovalStatus] = ApprovalStatus.WAITING
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
        if start_date and v and v < start_date:
            raise ValueError("end_date cannot be before start_date")
        return v


class StudentEngagementOut(StudentEngagementCreate):
    # Relax optionality for responses to support legacy records that may have
    # missing fields. Required fields for creation remain enforced by
    # StudentEngagementCreate.
    college_name: Optional[str] = None
    project_name: Optional[str] = None
    program_type: Optional[str] = None
    duration_months: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    record_id: str
    owner_email: str
    created_at: datetime
    updated_at: datetime


class InitEngagementUpload(BaseModel):
    filename: str
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None
    content_hash: str = Field(..., min_length=32)
