from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class IngestionJobOut(BaseModel):
    job_id: str
    project_id: str
    filename: str
    storage_key: str
    dataset_type: str | None = None
    header_mode: str | None = None
    custom_headers: Optional[List[str]] = None
    status: str
    progress: int = 0
    message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    sample_rows: Optional[List[dict]] = None
    columns: Optional[List[str]] = None
    rows_seen: Optional[int] = None
    metadata: Optional[dict] = None

    class Config:
        from_attributes = True


class IngestionCreateResponse(BaseModel):
    job_id: str
    project_id: str
    filename: str
    storage_key: str
    dataset_type: str | None = None
    header_mode: str | None = None
    status: str
    autoscale: dict


class IngestionStatus(BaseModel):
    status: str
    progress: int
    message: Optional[str] = None
