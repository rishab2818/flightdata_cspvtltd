


from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

# for the log-log and semi log 
AxisScale = Literal["linear" , 'log']
SourceType = Literal["tabular", "mat"]


class DerivedColumnInput(BaseModel):
    name: str = Field(..., description="Name of derived column")
    expression: str = Field(..., description="Formula expression, e.g. [A] / [B]")


class VisualizationSeriesInput(BaseModel):
    series_id: Optional[str] = Field(
        None,
        description="Frontend-generated stable id for this plot slot, used to let the "
        "client toggle trace visibility client-side without regenerating the chart",
    )
    enabled: bool = Field(
        True,
        description="Initial trace visibility. Disabled series are still rendered "
        "(as legendonly) so the client can toggle them back on instantly.",
    )
    job_id: str = Field(..., description="Ingestion job ID for this series")
    x_axis: str = Field(..., description="Column to plot on X axis for this series")
    y_axis: str = Field(..., description="Column to plot on Y axis for this series")
    x_values: Optional[list[float]] = Field(
        None,
        description="Optional literal X values for row-based plotting",
    )
    y_values: Optional[list[float]] = Field(
        None,
        description="Optional literal Y values for row-based plotting",
    )
    z_axis: Optional[str] = Field(None, description="Column to plot on Z axis (contour)")
    label: Optional[str] = Field(None, description="Optional legend label override")
    chart_type: Optional[str] = Field(
        None,
        description="Optional per-series chart type override for mixed 2D overplot",
    )
    derived_columns: list[DerivedColumnInput] = Field(default_factory=list)

    # Extra Inputs for the log and semi log function 
    x_scale : AxisScale = Field("linear" , description ="X Axis scale : linear /log")
    y_scale : AxisScale = Field("linear",description ="Y axis scale :linear/log")



class VisualizationSeriesOut(VisualizationSeriesInput):
    filename: str


MatlabLikeMode = Literal["plot_y", "plot_xy", "plot3"]


class MatVariableSliceInput(BaseModel):
    var: str = Field(..., description="MAT variable name")
    slice_expr: Optional[str] = Field(
        None,
        description="Optional MATLAB-style slice expression (e.g. (:,:,1))",
    )


class MatlabLikeRequestInput(BaseModel):
    mode: MatlabLikeMode
    x: Optional[MatVariableSliceInput] = None
    y: Optional[MatVariableSliceInput] = None
    z: Optional[MatVariableSliceInput] = None


class VisualizationCreateRequest(BaseModel):
    project_id: str = Field(..., description="Project ID the visualization belongs to")
    source_type: SourceType = Field(default="tabular")
    dataset_type: Optional[str] = None
    tag_name: Optional[str] = None
    name: Optional[str] = None
    series: list[VisualizationSeriesInput] = Field(default_factory=list)
    job_id: Optional[str] = None
    var: Optional[str] = None
    mapping: Optional[dict[str, Any]] = None
    filters: dict[str, Any] = Field(default_factory=dict)
    slice_expr: Optional[str] = None
    mat_request: Optional[MatlabLikeRequestInput] = None
    mat_derived_formulas: list[dict[str, Any]] = Field(default_factory=list)
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
    name: Optional[str] = None

    class Config:
        from_attributes = True


class VisualizationStatus(BaseModel):
    status: str
    progress: int
    message: Optional[str] = None
