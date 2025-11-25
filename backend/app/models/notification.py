from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class NotificationBase(BaseModel):
    title: Optional[str] = None
    message: str
    category: str = "general"
    link: Optional[str] = None


class NotificationCreate(NotificationBase):
    user_email: EmailStr


class NotificationOut(NotificationBase):
    id: str
    user_email: EmailStr
    is_read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True
