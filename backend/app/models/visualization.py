from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class VisualizationCreateRequest(BaseModel):
    project_id: str = Field(..., description="Project ID the visualization belongs to")
    job_id: str = Field(..., description="Ingestion job ID that stores the dataset")
    x_axis: str
    y_axis: str
    chart_type: str = Field(default="scatter", description="Type of chart to render")


class VisualizationOut(BaseModel):
    viz_id: str
    project_id: str
    job_id: str
    filename: str
    x_axis: str
    y_axis: str
    chart_type: str
    status: str
    progress: int = 0
    message: Optional[str] = None
    html_key: Optional[str] = None
    html_url: Optional[str] = None
    html: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VisualizationStatus(BaseModel):
    status: str
    progress: int
    message: Optional[str] = None
