from typing import Optional

from pydantic import BaseModel


class RawPreviewDetailOut(BaseModel):
    job_id: str
    filename: str
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None
    kind: str
    download_url: Optional[str] = None


class RawTextChunkOut(BaseModel):
    job_id: str
    filename: str
    offset: int
    next_offset: int
    chunk_size: int
    has_more: bool
    lines: list[str]


class RawExcelPreviewOut(BaseModel):
    job_id: str
    filename: str
    active_sheet: str
    sheet_names: list[str]
    rows: list[list[object]]
    row_limit: int

