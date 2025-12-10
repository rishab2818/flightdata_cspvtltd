from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class BudgetAttachment(BaseModel):
    storage_key: Optional[str] = Field(None, description="Object key for uploaded file")
    original_name: Optional[str] = None
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None
    content_hash: Optional[str] = Field(None, description="Hash of the uploaded file")


class BudgetForecastCreate(BudgetAttachment):
    forecast_year: Optional[str] = Field(
        None,
        description="Financial year for the forecast (e.g., 2024-25)",
    )
    cash_outgo_split_over: Optional[str] = Field(
        None,
        description="Financial year that cash outgo is spread over",
    )
    division_name: Optional[str] = None
    descriptions: Optional[str] = None
    item: Optional[str] = None
    qty: Optional[int] = Field(None, ge=0)
    previous_procurement_date: Optional[date] = None
    estimated_cost: Optional[float] = Field(None, ge=0)
    demand_indication_months: Optional[int] = Field(None, ge=0)
    build_or_project: Optional[str] = None
    dpp_number: Optional[str] = None
    cash_outgo: Optional[float] = Field(None, ge=0)
    cash_outgo_split: Optional[float] = Field(None, ge=0)
    existing_stock: Optional[int] = Field(None, ge=0)
    common_tdcc: Optional[str] = None
    cross_project_use: Optional[str] = None
    hardware_need: Optional[str] = None
    condemnation: Optional[str] = None
    capital_or_revenue: Optional[str] = Field(
    None,
    description="Indicates whether the item is Capital or Revenue"
)

    remarks: Optional[str] = None


class BudgetForecastOut(BudgetForecastCreate):
    record_id: str
    owner_email: str
    created_at: datetime
    updated_at: datetime
