from datetime import date, datetime
from pydantic import BaseModel, Field

from app.models.documents import DocumentSection, MoMSubsection


class NextMeetingPayload(BaseModel):
    section: DocumentSection = Field(..., description="Only minutes_of_meeting is currently supported")
    subsection: MoMSubsection
    title: str = Field(..., min_length=1, max_length=200)
    meeting_date: date
    meeting_time: str = Field(
        ...,
        pattern=r"^\d{2}:\d{2}$",
        description="24-hour time in HH:MM format",
    )


class NextMeetingOut(NextMeetingPayload):
    updated_at: datetime
    owner_email: str
