"""
Models for flight data plots.

Defines schemas for creating and retrieving plot metadata. Each plot
consists of one or more columns from one or more flight data files and
belongs to a specific project and owner. The plot generation is
handled asynchronously by a Celery worker; progress and results are
stored in the database and object storage.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class PlotColumn(BaseModel):
    """A reference to a column in a flight data file."""

    file_id: str = Field(..., description="Identifier of the flight data file")
    column_name: str = Field(..., description="Name of the column within the file")
    label: Optional[str] = Field(None, description="Optional label to use in the plot legend")


class PlotCreate(BaseModel):
    """Request body for creating a plot."""

    project_id: str = Field(..., description="ID of the project to which the plot belongs")
    columns: List[PlotColumn] = Field(..., description="List of file/column pairs to plot")
    title: Optional[str] = Field(None, description="Optional title for the plot")


class PlotOut(BaseModel):
    """Representation of a plot record returned to clients."""

    plot_id: str
    project_id: str
    owner_email: str
    columns: List[PlotColumn]
    title: Optional[str]
    status: str
    progress: float
    result_url: Optional[str]
    created_at: datetime
    finished_at: Optional[datetime]
    access_emails: List[str] = Field(default_factory=list)