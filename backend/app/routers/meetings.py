from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import CurrentUser, get_current_user
from app.db.mongo import get_db
from app.models.documents import DocumentSection, MoMSubsection
from app.models.meeting import NextMeetingOut, NextMeetingPayload
from app.repositories.projects import ProjectRepository

router = APIRouter(prefix="/api/meetings", tags=["meetings"])
project_repo = ProjectRepository()


def _normalize_section(section: DocumentSection | None) -> DocumentSection:
    normalized = section or DocumentSection.MINUTES_OF_MEETING
    if normalized != DocumentSection.MINUTES_OF_MEETING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only minutes_of_meeting supports meeting scheduling",
        )
    return normalized


@router.get("/next", response_model=NextMeetingOut)
async def get_next_meeting(
    section: DocumentSection | None = Query(None),
    subsection: MoMSubsection | None = Query(None),
    project_id: str | None = Query(
        None, description="Optional project context for PMRC meetings"
    ),
    user: CurrentUser = Depends(get_current_user),
):
    section = _normalize_section(section)
    subsection = subsection or MoMSubsection.TCM
    if project_id:
        project = await project_repo.get_if_member(project_id, user.email)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found or access denied",
            )
    db = await get_db()
    doc = await db.meeting_schedules.find_one(
        {
            "owner_email": user.email,
            "section": section.value,
            "subsection": subsection.value,
            "project_id": project_id,
        }
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not set")

    return NextMeetingOut(
        section=section,
        subsection=subsection,
        title=doc.get("title"),
        meeting_date=doc.get("meeting_date").date()
        if doc.get("meeting_date")
        else None,
        meeting_time=doc.get("meeting_time"),
        updated_at=doc.get("updated_at"),
        owner_email=user.email,
        project_id=project_id,
    )


@router.put("/next", response_model=NextMeetingOut)
async def upsert_next_meeting(
    payload: NextMeetingPayload, user: CurrentUser = Depends(get_current_user)
):
    section = _normalize_section(payload.section)
    subsection = payload.subsection or MoMSubsection.TCM

    if payload.project_id:
        project = await project_repo.get_if_member(payload.project_id, user.email)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found or access denied",
            )

    normalized_title = (payload.title or "").strip() or None
    now = datetime.utcnow()

    doc = {
        "owner_email": user.email,
        "section": section.value,
        "subsection": subsection.value,
        "project_id": payload.project_id,
        "title": normalized_title,
        "updated_at": now,
    }

    if payload.meeting_date:
        doc["meeting_date"] = datetime(
            payload.meeting_date.year,
            payload.meeting_date.month,
            payload.meeting_date.day,
        )

    if payload.meeting_time:
        doc["meeting_time"] = payload.meeting_time

    db = await get_db()
    await db.meeting_schedules.update_one(
        {
            "owner_email": user.email,
            "section": section.value,
            "subsection": subsection.value,
            "project_id": payload.project_id,
        },
        {"$set": doc},
        upsert=True,
    )

    return NextMeetingOut(
        section=section,
        subsection=subsection,
        title=normalized_title,
        meeting_date=payload.meeting_date,
        meeting_time=payload.meeting_time,
        updated_at=now,
        owner_email=user.email,
        project_id=payload.project_id,
    )
