from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.documents import DocumentSection, MoMSubsection


class NextMeetingPayload(BaseModel):
    section: Optional[DocumentSection] = Field(
        DocumentSection.MINUTES_OF_MEETING,
        description="Only minutes_of_meeting is currently supported",
    )
    subsection: Optional[MoMSubsection] = Field(MoMSubsection.TCM)
    title: Optional[str] = Field(None, min_length=0, max_length=200)
    meeting_date: Optional[date] = None
    meeting_time: Optional[str] = Field(
        None,
        pattern=r"^\d{2}:\d{2}$",
        description="24-hour time in HH:MM format",
    )
    project_id: Optional[str] = Field(
        default=None,
        description="Optional project context for PMRC minutes",
    )


class NextMeetingOut(NextMeetingPayload):
    updated_at: Optional[datetime] = None
    owner_email: Optional[str] = None
