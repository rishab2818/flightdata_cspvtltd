from fastapi import APIRouter, Depends, Query

from app.core.auth import CurrentUser, get_current_user
from app.models.documents import DocumentSection, MoMSubsection
from app.models.meeting import NextMeetingOut, NextMeetingPayload
from app.services.meetings_service import MeetingsService

router = APIRouter(prefix="/api/meetings", tags=["meetings"])
meetings_service = MeetingsService()


@router.get("/next", response_model=NextMeetingOut)
async def get_next_meeting(
    section: DocumentSection | None = Query(None),
    subsection: MoMSubsection | None = Query(None),
    project_id: str | None = Query(
        None, description="Optional project context for PMRC meetings"
    ),
    user: CurrentUser = Depends(get_current_user),
):
    return await meetings_service.get_next_meeting(
        user=user,
        section=section,
        subsection=subsection,
        project_id=project_id,
    )


@router.put("/next", response_model=NextMeetingOut)
async def upsert_next_meeting(
    payload: NextMeetingPayload, user: CurrentUser = Depends(get_current_user)
):
    return await meetings_service.upsert_next_meeting(payload=payload, user=user)
