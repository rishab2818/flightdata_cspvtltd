# from datetime import datetime
# from typing import List, Optional
# from pydantic import BaseModel, Field


# class IngestionJobOut(BaseModel):
#     job_id: str
#     project_id: str
#     filename: str
#     storage_key: str
#     dataset_type: str | None = None
#     header_mode: str | None = None
#     custom_headers: Optional[List[str]] = None
#     status: str
#     progress: int = 0
#     message: Optional[str] = None
#     created_at: datetime
#     updated_at: datetime
#     sample_rows: Optional[List[dict]] = None
#     columns: Optional[List[str]] = None
#     rows_seen: Optional[int] = None
#     metadata: Optional[dict] = None

#     class Config:
#         from_attributes = True


# class IngestionCreateResponse(BaseModel):
#     job_id: str
#     project_id: str
#     filename: str
#     storage_key: str
#     dataset_type: str | None = None
#     header_mode: str | None = None
#     status: str
#     autoscale: dict


# class IngestionStatus(BaseModel):
#     status: str
#     progress: int
#     message: Optional[str] = None
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class IngestionJobOut(BaseModel):
    job_id: str
    project_id: str
    filename: str
    storage_key: str
    processed_key: Optional[str] = None
    sheet_name: Optional[str] = None

    dataset_type: Optional[str] = None  # cfd/wind/flight
    tag_name: Optional[str] = None
    visualize_enabled: bool = False

    content_type: Optional[str] = None
    size_bytes: Optional[int] = None

    header_mode: Optional[str] = None
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
    derived_columns: Optional[List[dict]] = None


class IngestionCreateResponse(BaseModel):
    job_id: str
    project_id: str
    filename: str
    storage_key: str
    dataset_type: Optional[str] = None
    tag_name: Optional[str] = None
    visualize_enabled: bool = False
    header_mode: Optional[str] = None
    sheet_name: Optional[str] = None
    status: str
    autoscale: dict


class IngestionBatchCreateResponse(BaseModel):
    batch_id: str
    project_id: str
    dataset_type: str
    tag_name: str
    jobs: List[IngestionCreateResponse]


class IngestionStatus(BaseModel):
    status: str
    progress: int
    message: Optional[str] = None
