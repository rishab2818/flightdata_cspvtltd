from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import CurrentUser, get_current_user
from app.raw_preview.schemas import RawExcelPreviewOut, RawPreviewDetailOut, RawTextChunkOut
from app.raw_preview.service import (
    build_download_url,
    detect_preview_kind,
    get_object_size,
    read_excel_preview,
    read_text_chunk,
)
from app.repositories.ingestions import IngestionRepository
from app.repositories.projects import ProjectRepository

router = APIRouter(prefix="/api/raw-preview", tags=["raw-preview"])
repo = IngestionRepository()
projects = ProjectRepository()


async def _ensure_project_member(project_id: str, user: CurrentUser):
    doc = await projects.get_if_member(project_id, user.email)
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found or no access")
    return doc


async def _get_job_or_404(job_id: str, user: CurrentUser) -> dict:
    doc = await repo.get_job(job_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found")
    await _ensure_project_member(doc["project_id"], user)
    return doc


@router.get("/jobs/{job_id}", response_model=RawPreviewDetailOut)
async def raw_preview_detail(job_id: str, user: CurrentUser = Depends(get_current_user)):
    doc = await _get_job_or_404(job_id, user)
    return RawPreviewDetailOut(
        job_id=job_id,
        filename=doc.get("filename") or "download",
        content_type=doc.get("content_type"),
        size_bytes=doc.get("size_bytes") or get_object_size(doc["storage_key"]),
        kind=detect_preview_kind(doc.get("filename"), doc.get("content_type")),
        download_url=build_download_url(doc["storage_key"]),
    )


@router.get("/jobs/{job_id}/text", response_model=RawTextChunkOut)
async def raw_preview_text(
    job_id: str,
    offset: int = Query(0, ge=0),
    chunk_size: int = Query(262144, ge=32768, le=1048576),
    user: CurrentUser = Depends(get_current_user),
):
    doc = await _get_job_or_404(job_id, user)
    kind = detect_preview_kind(doc.get("filename"), doc.get("content_type"))
    if kind != "text":
        raise HTTPException(status_code=400, detail="Chunked text preview is only supported for text-like raw files")

    payload = read_text_chunk(
        storage_key=doc["storage_key"],
        offset=offset,
        chunk_size=chunk_size,
        size_bytes=doc.get("size_bytes"),
    )
    return RawTextChunkOut(
        job_id=job_id,
        filename=doc.get("filename") or "download",
        **payload,
    )


@router.get("/jobs/{job_id}/excel", response_model=RawExcelPreviewOut)
async def raw_preview_excel(
    job_id: str,
    sheet_name: str | None = Query(None),
    row_limit: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
):
    doc = await _get_job_or_404(job_id, user)
    kind = detect_preview_kind(doc.get("filename"), doc.get("content_type"))
    if kind != "excel":
        raise HTTPException(status_code=400, detail="Excel preview is only supported for Excel raw files")

    payload = read_excel_preview(
        storage_key=doc["storage_key"],
        filename=doc.get("filename") or "workbook.xlsx",
        sheet_name=sheet_name,
        row_limit=row_limit,
    )
    return RawExcelPreviewOut(
        job_id=job_id,
        filename=doc.get("filename") or "workbook.xlsx",
        **payload,
    )
