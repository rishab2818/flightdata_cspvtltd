from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class AxisRequest(BaseModel):
    columns: List[str] = Field(min_length=1, description="One or more column headers")
    label: Optional[str] = Field(
        default=None, description="Friendly name for this axis grouping"
    )


class SeriesRequest(BaseModel):
    job_id: str
    x_axes: List[str] = Field(min_length=1)
    y_axes: List[str] = Field(min_length=1)
    z_axes: Optional[List[str]] = None
    label: Optional[str] = None


class VisualizationCreate(BaseModel):
    name: str
    description: Optional[str] = None
    series: List[SeriesRequest] = Field(min_length=1)


class VisualizationOut(BaseModel):
    viz_id: str
    project_id: str
    name: str
    description: Optional[str] = None
    series: List[SeriesRequest]
    status: str
    progress: int
    message: Optional[str] = None
    chunk_size: int
    chunk_count: int = 0
    rows_total: int = 0
    trace_labels: List[dict] = Field(default_factory=list)
    image_format: str = "png"
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VisualizationCreateResponse(BaseModel):
    viz_id: str
    project_id: str
    name: str
    status: str
    chunk_size: int
    image_format: str = "png"


class VisualizationStatus(BaseModel):
    status: str
    progress: int
    message: Optional[str] = None


class VisualizationDataPage(BaseModel):
    viz_id: str
    chunk_index: int
    next_chunk: Optional[int]
    rows: List[dict]
    total_chunks: int
    total_rows: int


class VisualizationImage(BaseModel):
    url: str
