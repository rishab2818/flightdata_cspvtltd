from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.auth import CurrentUser, get_current_user
from app.models.notification import NotificationCreate, NotificationOut
from app.repositories.notifications import NotificationRepository

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
repo = NotificationRepository()


class NotificationBody(BaseModel):
    title: Optional[str] = None
    message: str
    category: str = "general"
    link: Optional[str] = None


@router.get("", response_model=List[NotificationOut])
async def list_notifications(
    limit: int = Query(25, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
):
    return await repo.list_for_user(user.email, limit=limit)


@router.post("", response_model=NotificationOut, status_code=status.HTTP_201_CREATED)
async def create_notification(body: NotificationBody, user: CurrentUser = Depends(get_current_user)):
    payload = NotificationCreate(**body.model_dump(), user_email=user.email)
    return await repo.create(payload)


@router.patch("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(notification_id: str, user: CurrentUser = Depends(get_current_user)):
    updated = await repo.mark_as_read(notification_id, user.email)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    await repo.delete_for_user(notification_id, user.email)


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(user: CurrentUser = Depends(get_current_user)):
    await repo.mark_all_as_read(user.email)
    await repo.delete_all_for_user(user.email)
