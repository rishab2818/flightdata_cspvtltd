# from datetime import datetime
# from typing import Optional

# from pydantic import BaseModel, Field


# class VisualizationSeriesInput(BaseModel):
#     job_id: str = Field(..., description="Ingestion job ID for this series")
#     x_axis: str 
#     y_axis: str = Field(..., description="Column to plot on the Y axis")
#     label: Optional[str] = Field(None, description="Optional legend label override")


# class VisualizationSeriesOut(VisualizationSeriesInput):
#     filename: str


# class VisualizationCreateRequest(BaseModel):
#     project_id: str = Field(..., description="Project ID the visualization belongs to")
#     # x_axis: str will remove from here 
#     series: list[VisualizationSeriesInput]
#     chart_type: str = Field(default="scatter", description="Type of chart to render")


# class VisualizationOut(BaseModel):
#     viz_id: str
#     project_id: str
#     x_axis: str
#     chart_type: str
#     series: list[VisualizationSeriesOut]
#     status: str
#     progress: int = 0
#     message: Optional[str] = None
#     html_key: Optional[str] = None
#     html_url: Optional[str] = None
#     html: Optional[str] = None
#     tiles: Optional[list[dict]] = None
#     series_stats: Optional[list[dict]] = None
#     created_at: datetime
#     updated_at: datetime
#     filename: Optional[str] = None
#     job_id: Optional[str] = None
#     y_axis: Optional[str] = None

#     class Config:
#         from_attributes = True


# class VisualizationStatus(BaseModel):
#     status: str
#     progress: int
#     message: Optional[str] = None


from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class VisualizationSeriesInput(BaseModel):
    job_id: str = Field(..., description="Ingestion job ID for this series")
    x_axis: str = Field(..., description="Column to plot on X axis for this series")
    y_axis: str = Field(..., description="Column to plot on Y axis for this series")
    z_axis: Optional[str] = Field(None, description="Column to plot on Z axis (contour)")
    label: Optional[str] = Field(None, description="Optional legend label override")


class VisualizationSeriesOut(VisualizationSeriesInput):
    filename: str


class VisualizationCreateRequest(BaseModel):
    project_id: str = Field(..., description="Project ID the visualization belongs to")
    series: list[VisualizationSeriesInput]
    chart_type: str = Field(default="scatter", description="Type of chart to render")


class VisualizationOut(BaseModel):
    viz_id: str
    project_id: str
    chart_type: str
    series: list[VisualizationSeriesOut]

    status: str
    progress: int = 0
    message: Optional[str] = None

    html_key: Optional[str] = None
    html_url: Optional[str] = None
    html: Optional[str] = None

    tiles: Optional[list[dict]] = None
    series_stats: Optional[list[dict]] = None

    created_at: datetime
    updated_at: datetime

    filename: Optional[str] = None

    class Config:
        from_attributes = True


class VisualizationStatus(BaseModel):
    status: str
    progress: int
    message: Optional[str] = None
