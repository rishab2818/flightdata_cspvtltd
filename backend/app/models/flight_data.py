"""
Pydantic models for Flight Data file uploads.

This module defines the schemas used when uploading large Excel/CSV
flight data files. Each file is associated with a project and a
section (wind tunnel, aero or CFD). To support deduplication and
metadata extraction the client must first request a presigned upload
URL and then confirm the upload once the file has been stored in
object storage. The confirm step will trigger an asynchronous task
to read just the header row from the file and persist it in the
database.
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class FlightDataSection(str, Enum):
    """Top‑level categories for flight data.

    These values correspond to folders/prefixes in object storage.
    """

    WIND_TUNNEL = "wind_tunnel"
    AERO = "aero"
    CFD = "cfd"


class FlightDataInitUpload(BaseModel):
    """Request body for beginning an upload.

    The client posts this to receive a presigned URL for directly
    uploading a large file to MinIO/S3. We require the project
    identifier, section, original filename and a content hash to
    enforce deduplication. The content hash should be a strong
    checksum such as SHA‑256 represented as a hex string.
    """

    project_id: str = Field(..., description="ID of the project this file belongs to")
    section: FlightDataSection
    filename: str = Field(..., description="Original name of the uploaded file")
    content_type: Optional[str] = Field(None, description="MIME type of the file")
    size_bytes: Optional[int] = Field(None, description="Size of the file in bytes")
    content_hash: str = Field(
        ...,
        description="Strong hash of the file contents (e.g. SHA256 hex)",
        min_length=32,
    )


class FlightDataConfirm(BaseModel):
    """Body used to register a flight data file after upload completes.

    Once the client has successfully uploaded to the presigned URL,
    they call this endpoint with the same metadata plus the object
    key returned earlier. This call inserts a document in the
    database and kicks off an asynchronous task to parse the header.
    """

    project_id: str
    section: FlightDataSection
    storage_key: str = Field(..., description="Object key in MinIO/S3")
    original_name: str = Field(..., description="Original filename")
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None
    content_hash: str = Field(
        ...,
        description="Same hash as used in the init call to enforce dedupe",
        min_length=32,
    )


class FlightDataFileOut(BaseModel):
    """Shape returned when listing flight data files.

    This mirrors the stored Mongo document and includes the
    extracted header row. Only users with access to the file will
    see it in list responses.
    """

    file_id: str
    project_id: str
    owner_email: str
    section: str
    original_name: str
    storage_key: str
    size_bytes: Optional[int] = None
    content_type: Optional[str] = None
    uploaded_at: datetime
    headers: Optional[List[str]] = None
    access_emails: List[str] = Field(
        default_factory=list,
        description="List of user emails that have been granted access",
    )

    class Config:
        from_attributes = True