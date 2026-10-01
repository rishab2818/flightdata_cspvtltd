from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import CurrentUser, get_current_user, require_head
from app.db.mongo import get_db
from app.models.performance import (
    PerformanceFrequency,
    PerformanceSettingsOut,
    PerformanceSettingsPayload,
    ReviewCycleOut,
)
from app.services.performance_cycle_service import PerformanceCycleService

router = APIRouter(prefix="/api/performance-settings", tags=["performance-settings"])


def _date_value(value) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    return value


def _cycle_out(cycle: Optional[dict]) -> Optional[ReviewCycleOut]:
    if not cycle:
        return None
    return ReviewCycleOut(
        cycle_id=str(cycle["_id"]),
        organization_id=cycle["organization_id"],
        start_date=_date_value(cycle["start_date"]),
        end_date=_date_value(cycle["end_date"]),
        status=cycle["status"],
        frequency=cycle["frequency"],
        sequence_number=cycle.get("sequence_number", 1),
        created_at=cycle["created_at"],
        updated_at=cycle["updated_at"],
    )


async def _response(service: PerformanceCycleService) -> PerformanceSettingsOut:
    settings = await service.get_settings()
    current_cycle = await service.ensure_current_cycle_exists()
    return PerformanceSettingsOut(
        organization_id=service.organization_id,
        frequency=settings.get("frequency") if settings else None,
        first_cycle_start_date=_date_value(settings.get("first_cycle_start_date"))
        if settings
        else None,
        first_cycle_end_date=_date_value(settings.get("first_cycle_end_date"))
        if settings
        else None,
        current_cycle=_cycle_out(current_cycle),
        available_frequencies=list(PerformanceFrequency),
        updated_at=settings.get("updated_at") if settings else None,
    )


@router.get("", response_model=PerformanceSettingsOut)
async def get_performance_settings(
    user: CurrentUser = Depends(get_current_user),
):
    db = await get_db()
    service = PerformanceCycleService(db=db)
    return await _response(service)


@router.put("", response_model=PerformanceSettingsOut)
async def save_performance_settings(
    payload: PerformanceSettingsPayload,
    user: CurrentUser = Depends(get_current_user),
):
    require_head(user)
    db = await get_db()
    service = PerformanceCycleService(db=db)
    try:
        await service.save_settings(
            payload.frequency, payload.first_cycle_start_date
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return await _response(service)
