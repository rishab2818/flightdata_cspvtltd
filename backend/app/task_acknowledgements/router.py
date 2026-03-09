from typing import List

from fastapi import APIRouter, Depends, Query

from app.core.auth import CurrentUser, get_current_user
from app.task_acknowledgements.models import (
    TaskAcknowledgementActionResult,
    TaskAcknowledgementOut,
)
from app.task_acknowledgements.service import (
    acknowledge_task_request,
    list_pending_acknowledgements_for_user,
)

router = APIRouter(prefix="/api/task-acknowledgements", tags=["task-acknowledgements"])


@router.get("/pending", response_model=List[TaskAcknowledgementOut])
async def list_pending_task_acknowledgements(
    limit: int = Query(10, ge=1, le=20),
    user: CurrentUser = Depends(get_current_user),
):
    return await list_pending_acknowledgements_for_user(user_email=user.email, limit=limit)


@router.post("/{acknowledgement_id}/acknowledge", response_model=TaskAcknowledgementActionResult)
async def acknowledge_task_acknowledgement(
    acknowledgement_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    return await acknowledge_task_request(
        acknowledgement_id=acknowledgement_id,
        user_email=user.email,
    )
