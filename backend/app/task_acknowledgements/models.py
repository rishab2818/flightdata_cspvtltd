from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class TaskAcknowledgementState(str, Enum):
    PENDING_ASSIGNEE = "pending_assignee"
    PENDING_ASSIGNER = "pending_assigner"


class TaskAcknowledgementOut(BaseModel):
    id: str
    state: TaskAcknowledgementState
    source_type: str = "generic"
    source_label: str
    task_description: str
    assigner_email: str
    assigner_name: Optional[str] = None
    assignee_email: str
    assignee_name: Optional[str] = None
    acknowledged_by_email: Optional[str] = None
    acknowledged_by_name: Optional[str] = None
    button_label: str = Field(default="Okay")
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TaskAcknowledgementActionResult(BaseModel):
    status: str
