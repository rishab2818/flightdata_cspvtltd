"""Standalone backup implementation of the Digital Library backend.

Self-contained: does not import from documents.py. Uses the same MongoDB
collection, MinIO bucket and auth as the main app, so records are shared
with the primary Digital Library and either can be used at any time.

Enable by adding to app/main.py:
    from app.routers import digital_library_backup
    app.include_router(digital_library_backup.router)

All file bytes flow through this API; the browser never talks to MinIO.
"""
import hashlib
import io
from datetime import date, datetime
from typing import List, Optional
from urllib.parse import quote
from uuid import uuid4

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.core.file_restrictions import ensure_allowed_filename
from app.core.minio_client import get_minio_client
from app.db.mongo import get_db
from app.repositories.projects import ProjectRepository

# ============================== CONFIG ==============================
CONFIG = {
    "route_prefix": "/api/digital-library-backup",
    "section": "digital_library",            # same section as the main Digital Library
    "mongo_collection": "user_documents",    # same collection as the main app
    "minio_bucket": settings.minio_docs_bucket,
    "max_upload_bytes": 500 * 1024 * 1024,   # 500 MB; set None for no limit
    "stream_chunk_bytes": 64 * 1024,
    "default_page_size": 30,
    "max_page_size": 100,
    "delete_roles": {"GD", "DH", "TL", "SM"},
}
# ====================================================================

router = APIRouter(prefix=CONFIG["route_prefix"], tags=["digital-library-backup"])
project_repo = ProjectRepository()


class DocumentUpdateBody(BaseModel):
    tag: Optional[str] = None
    doc_date: Optional[date] = None


def _collection(db):
    return db[CONFIG["mongo_collection"]]


def _oid(doc_id: str) -> ObjectId:
    try:
        return ObjectId(doc_id)
    except (InvalidId, TypeError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")


def _serialize(row: dict) -> dict:
    doc_date = row.get("doc_date")
    return {
        "doc_id": str(row["_id"]),
        "owner_email": row.get("owner_email"),
        "section": row.get("section"),
        "tag": row.get("tag"),
        "doc_date": doc_date.date().isoformat() if isinstance(doc_date, datetime) else doc_date,
        "original_name": row.get("original_name"),
        "storage_key": row.get("storage_key"),
        "size_bytes": row.get("size_bytes"),
        "content_type": row.get("content_type"),
        "uploaded_at": row.get("uploaded_at"),
        "project_id": row.get("project_id"),
    }


async def _require_project_member(project_id: str, user: CurrentUser) -> None:
    project = await project_repo.get_if_member(project_id, user.email)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found or access denied")


async def _get_accessible_row(doc_id: str, user: CurrentUser) -> dict:
    db = await get_db()
    row = await _collection(db).find_one(
        {"_id": _oid(doc_id), "section": CONFIG["section"]}
    )
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")

    project_id = row.get("project_id")
    if project_id and await project_repo.get_if_member(project_id, user.email):
        return row
    if row.get("owner_email") == user.email:
        return row
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")


@router.get("")
async def list_documents(
    project_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(CONFIG["default_page_size"], ge=1, le=CONFIG["max_page_size"]),
    user: CurrentUser = Depends(get_current_user),
) -> List[dict]:
    query: dict = {"section": CONFIG["section"]}
    if project_id:
        await _require_project_member(project_id, user)
        query["project_id"] = project_id
    else:
        query["owner_email"] = user.email

    db = await get_db()
    cursor = (
        _collection(db)
        .find(query)
        .sort("uploaded_at", -1)
        .skip((page - 1) * limit)
        .limit(limit)
    )
    rows = await cursor.to_list(length=limit)
    return [_serialize(r) for r in rows]


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    tag: str = Form(...),
    doc_date: str = Form(...),
    project_id: Optional[str] = Form(None),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    filename = ensure_allowed_filename(file.filename)
    if not filename:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File name is required")
    if not tag.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "tag is required")

    try:
        parsed_date = datetime.strptime(doc_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "doc_date must be YYYY-MM-DD")

    if project_id:
        await _require_project_member(project_id, user)

    data = await file.read()
    max_bytes = CONFIG["max_upload_bytes"]
    if max_bytes and len(data) > max_bytes:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"File exceeds the {max_bytes // (1024 * 1024)} MB limit",
        )

    content_hash = hashlib.sha256(data).hexdigest()

    db = await get_db()
    col = _collection(db)

    dedupe = {
        "owner_email": user.email,
        "content_hash": content_hash,
        "section": CONFIG["section"],
    }
    if project_id:
        dedupe["project_id"] = project_id
    if await col.find_one(dedupe):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Duplicate document: this file already exists for this user.",
        )

    bucket = CONFIG["minio_bucket"]
    object_key = f"users/{user.email}/{CONFIG['section']}/{uuid4()}_{filename}"
    content_type = file.content_type or "application/octet-stream"

    try:
        minio = get_minio_client()
        if not minio.bucket_exists(bucket):
            minio.make_bucket(bucket)
        minio.put_object(
            bucket_name=bucket,
            object_name=object_key,
            data=io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )
    except Exception as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Storage backend is unavailable. Please try again later.",
        ) from exc

    doc = {
        "owner_email": user.email,
        "section": CONFIG["section"],
        "subsection": None,
        "tag": tag.strip(),
        "doc_date": parsed_date,
        "original_name": filename,
        "storage_key": object_key,
        "content_type": content_type,
        "size_bytes": len(data),
        "content_hash": content_hash,
        "uploaded_at": datetime.utcnow(),
        "action_points": [],
        "action_on": [],
        "project_id": project_id,
    }
    res = await col.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _serialize(doc)


@router.get("/{doc_id}/file")
async def get_file(
    doc_id: str,
    download: bool = Query(False),
    user: CurrentUser = Depends(get_current_user),
):
    row = await _get_accessible_row(doc_id, user)

    try:
        obj = get_minio_client().get_object(CONFIG["minio_bucket"], row["storage_key"])
    except Exception as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "Unable to fetch file from storage backend."
        ) from exc

    def _chunks():
        try:
            yield from obj.stream(CONFIG["stream_chunk_bytes"])
        finally:
            obj.close()
            obj.release_conn()

    name = row.get("original_name") or "download"
    ascii_name = name.encode("ascii", "ignore").decode("ascii") or "download"
    disposition = "attachment" if download else "inline"
    headers = {
        "Content-Disposition": (
            f'{disposition}; filename="{ascii_name}"; filename*=UTF-8\'\'{quote(name)}'
        ),
        "Access-Control-Expose-Headers": "Content-Disposition",
    }
    size = row.get("size_bytes")
    if size:
        headers["Content-Length"] = str(size)

    return StreamingResponse(
        _chunks(),
        media_type=row.get("content_type") or "application/octet-stream",
        headers=headers,
    )


@router.put("/{doc_id}")
async def update_document(
    doc_id: str,
    body: DocumentUpdateBody,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    row = await _get_accessible_row(doc_id, user)

    updates: dict = {}
    if body.tag is not None:
        if not body.tag.strip():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "tag cannot be empty")
        updates["tag"] = body.tag.strip()
    if body.doc_date is not None:
        updates["doc_date"] = datetime(
            body.doc_date.year, body.doc_date.month, body.doc_date.day
        )

    db = await get_db()
    col = _collection(db)
    if updates:
        await col.update_one({"_id": row["_id"]}, {"$set": updates})
    return _serialize(await col.find_one({"_id": row["_id"]}))


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    role = getattr(user.role, "value", user.role)
    if str(role).upper() not in CONFIG["delete_roles"]:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only " + "/".join(sorted(CONFIG["delete_roles"])) + " can delete",
        )

    row = await _get_accessible_row(doc_id, user)

    try:
        get_minio_client().remove_object(CONFIG["minio_bucket"], row["storage_key"])
    except Exception:
        pass

    db = await get_db()
    await _collection(db).delete_one({"_id": row["_id"]})
    return {"ok": True}
