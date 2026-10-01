from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class PerformanceFrequency(str, Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    HALF_YEARLY = "half_yearly"
    YEARLY = "yearly"


class ReviewCycleStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CLOSED = "closed"


class PerformanceSettingsPayload(BaseModel):
    frequency: PerformanceFrequency
    first_cycle_start_date: date

    @field_validator("first_cycle_start_date")
    @classmethod
    def validate_first_cycle_start_date(cls, value: date) -> date:
        if not value:
            raise ValueError("first_cycle_start_date is required")
        return value


class ReviewCycleOut(BaseModel):
    cycle_id: str
    organization_id: str
    start_date: date
    end_date: date
    status: ReviewCycleStatus
    frequency: PerformanceFrequency
    sequence_number: int = Field(ge=1)
    created_at: datetime
    updated_at: datetime


class PerformanceSettingsOut(BaseModel):
    organization_id: str
    frequency: Optional[PerformanceFrequency] = None
    first_cycle_start_date: Optional[date] = None
    first_cycle_end_date: Optional[date] = None
    current_cycle: Optional[ReviewCycleOut] = None
    available_frequencies: list[PerformanceFrequency]
    updated_at: Optional[datetime] = None
