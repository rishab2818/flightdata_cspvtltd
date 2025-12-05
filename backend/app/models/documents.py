from datetime import date, datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class DocumentSection(str, Enum):
    INVENTORY_RECORDS = "inventory_records"
    DIVISIONAL_RECORDS = "divisional_records"
    CUSTOMER_FEEDBACKS = "customer_feedbacks"
    TRAINING_RECORDS = "training_records"
    TECHNICAL_REPORTS = "technical_reports"
    MINUTES_OF_MEETING = "minutes_of_meeting"
    DIGITAL_LIBRARY = "digital_library"


class MoMSubsection(str, Enum):
    TCM = "tcm"
    PMRC = "pmrc"
    EBM = "ebm"
    GDM = "gdm"


class ActionPoint(BaseModel):
    description: str = Field(..., min_length=1)
    assigned_to: Optional[str] = Field(None, description="Person / role responsible")
    completed: bool = Field(default=False, description="Whether the action point is done")


class DocumentInitUpload(BaseModel):
    """Request body to start an upload (get presigned URL)."""

    section: DocumentSection
    # Required if section is MINUTES_OF_MEETING, otherwise must be omitted/null
    subsection: Optional[MoMSubsection] = None
    tag: str = Field(..., description="User label for the document")
    doc_date: date = Field(..., description="Document date selected by user")
    filename: str = Field(..., description="Original file name")
    content_type: Optional[str] = Field(
        None, description="MIME type, e.g. application/pdf"
    )
    size_bytes: Optional[int] = Field(None, description="File size in bytes")
    content_hash: str = Field(
        ...,
        description=(
            "Hash of file contents (e.g. SHA256 hex). "
            "Used to prevent duplicate uploads even if the filename changes."
        ),
        min_length=32,
    )
    action_points: List[ActionPoint] = Field(default_factory=list)
    action_on: List[str] = Field(
        default_factory=list,
        description="Top-level owners for the action items in this MoM.",
    )


class DocumentConfirm(BaseModel):
    """Called after file is uploaded to storage to register metadata."""

    section: DocumentSection
    subsection: Optional[MoMSubsection] = None
    tag: str
    doc_date: date
    storage_key: str = Field(..., description="Object key in MinIO")
    original_name: str = Field(..., description="Original file name")
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None
    content_hash: str = Field(
        ...,
        description="Same hash used during init-upload to enforce dedupe.",
        min_length=32,
    )
    action_points: List[ActionPoint] = Field(default_factory=list)
    action_on: List[str] = Field(
        default_factory=list,
        description="Top-level owners for the action items in this MoM.",
    )


class UserDocumentOut(BaseModel):
    """What we return when listing a user's documents."""

    doc_id: str
    owner_email: str
    section: str
    subsection: Optional[str] = None
    tag: str
    doc_date: date
    original_name: str
    storage_key: str
    size_bytes: Optional[int] = None
    content_type: Optional[str] = None
    uploaded_at: datetime
    action_points: List[ActionPoint] = Field(default_factory=list)
    action_on: List[str] = Field(default_factory=list)

    class Config:
        from_attributes = True


class DocumentUpdate(BaseModel):
    """Payload for updating an existing document."""

    tag: Optional[str] = None
    doc_date: Optional[date] = None
    action_points: Optional[List[ActionPoint]] = None
    action_on: Optional[List[str]] = None
