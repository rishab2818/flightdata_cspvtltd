from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import CurrentUser, get_current_user
from app.db.mongo import get_db
from app.models.documents import DocumentSection, MoMSubsection
from app.models.meeting import NextMeetingOut, NextMeetingPayload

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


def _ensure_mom_section(section: DocumentSection) -> None:
    if section != DocumentSection.MINUTES_OF_MEETING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only minutes_of_meeting supports meeting scheduling",
        )


@router.get("/next", response_model=NextMeetingOut)
async def get_next_meeting(
    section: DocumentSection = Query(...),
    subsection: MoMSubsection = Query(...),
    user: CurrentUser = Depends(get_current_user),
):
    _ensure_mom_section(section)
    db = await get_db()
    doc = await db.meeting_schedules.find_one(
        {
            "owner_email": user.email,
            "section": section.value,
            "subsection": subsection.value,
        }
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not set")

    return NextMeetingOut(
        section=section,
        subsection=subsection,
        title=doc["title"],
        meeting_date=doc["meeting_date"].date(),
        meeting_time=doc["meeting_time"],
        updated_at=doc["updated_at"],
        owner_email=user.email,
    )


@router.put("/next", response_model=NextMeetingOut)
async def upsert_next_meeting(
    payload: NextMeetingPayload, user: CurrentUser = Depends(get_current_user)
):
    _ensure_mom_section(payload.section)

    normalized_title = payload.title.strip()
    now = datetime.utcnow()

    doc = {
        "owner_email": user.email,
        "section": payload.section.value,
        "subsection": payload.subsection.value,
        "title": normalized_title,
        "meeting_date": datetime(
            payload.meeting_date.year, payload.meeting_date.month, payload.meeting_date.day
        ),
        "meeting_time": payload.meeting_time,
        "updated_at": now,
    }

    db = await get_db()
    await db.meeting_schedules.update_one(
        {
            "owner_email": user.email,
            "section": payload.section.value,
            "subsection": payload.subsection.value,
        },
        {"$set": doc},
        upsert=True,
    )

    return NextMeetingOut(
        section=payload.section,
        subsection=payload.subsection,
        title=normalized_title,
        meeting_date=payload.meeting_date,
        meeting_time=payload.meeting_time,
        updated_at=now,
        owner_email=user.email,
    )
