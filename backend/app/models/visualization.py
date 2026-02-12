


from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

# for the log-log and semi log 
AxisScale = Literal["linear" , 'log']
SourceType = Literal["tabular", "mat"]

class VisualizationSeriesInput(BaseModel):
    job_id: str = Field(..., description="Ingestion job ID for this series")
    x_axis: str = Field(..., description="Column to plot on X axis for this series")
    y_axis: str = Field(..., description="Column to plot on Y axis for this series")
    z_axis: Optional[str] = Field(None, description="Column to plot on Z axis (contour)")
    label: Optional[str] = Field(None, description="Optional legend label override")

    # Extra Inputs for the log and semi log function 
    x_scale : AxisScale = Field("linear" , description ="X Axis scale : linear /log")
    y_scale : AxisScale = Field("linear",description ="Y axis scale :linear/log")



class VisualizationSeriesOut(VisualizationSeriesInput):
    filename: str


class VisualizationCreateRequest(BaseModel):
    project_id: str = Field(..., description="Project ID the visualization belongs to")
    source_type: SourceType = Field(default="tabular")
    dataset_type: Optional[str] = None
    tag_name: Optional[str] = None
    series: list[VisualizationSeriesInput] = Field(default_factory=list)
    job_id: Optional[str] = None
    var: Optional[str] = None
    mapping: Optional[dict[str, Any]] = None
    filters: dict[str, Any] = Field(default_factory=dict)
    chart_type: str = Field(default="scatter", description="Type of chart to render")


class VisualizationOut(BaseModel):
    viz_id: str
    project_id: str
    dataset_type: Optional[str] = None
    tag_name: Optional[str] = None 
    source_type: SourceType = "tabular"
    chart_type: str
    series: list[VisualizationSeriesOut]
    mat_request: Optional[dict[str, Any]] = None

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
