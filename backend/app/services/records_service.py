from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Dict, Iterable, List
from uuid import uuid4

from bson import ObjectId
from fastapi import HTTPException, status

from app.core.auth import CurrentUser
from app.core.config import settings
from app.core.minio_client import get_minio_client
from app.db.mongo import get_db
from app.models.records import RecordSection


@dataclass
class RecordMeta:
    record_id: str
    owner_email: str
    created_at: datetime
    updated_at: datetime
    payload: Dict


class RecordsService:
    def __init__(self, bucket: str | None = None) -> None:
        self.bucket = bucket or settings.minio_docs_bucket

    async def init_upload(self, section: RecordSection, payload, user: CurrentUser) -> Dict:
        await self._ensure_bucket()

        db = await get_db()
        existing = await db.records.find_one(
            {
                "section": section.value,
                "owner_email": user.email,
                "content_hash": payload.content_hash,
            }
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Duplicate upload detected for this section.",
            )

        object_key = (
            f"users/{user.email}/records/{section.value}/{uuid4()}_{payload.filename}"
        )

        upload_url = get_minio_client().presigned_put_object(
            bucket_name=self.bucket,
            object_name=object_key,
            expires=timedelta(hours=1),
        )

        return {
            "upload_url": upload_url,
            "storage_key": object_key,
            "bucket": self.bucket,
            "expires_in": 3600,
        }

    async def create_record(
        self, section: RecordSection, payload_data: Dict, user: CurrentUser
    ) -> RecordMeta:
        record_id, doc = await self._insert_record(section, payload_data, user)
        return RecordMeta(
            record_id=record_id,
            owner_email=user.email,
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
            payload=payload_data,
        )

    async def update_record(
        self,
        section: RecordSection,
        record_id: str,
        payload_data: Dict,
        field_names: Iterable[str],
        user: CurrentUser,
    ) -> RecordMeta:
        db = await get_db()
        oid = ObjectId(record_id)
        existing = await db.records.find_one(
            {"_id": oid, "owner_email": user.email, "section": section.value}
        )
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

        normalized_payload = self._normalize_dates(payload_data)
        now = datetime.utcnow()

        await db.records.update_one({"_id": oid}, {"$set": {**normalized_payload, "updated_at": now}})

        merged_payload = {key: existing.get(key) for key in field_names}
        merged_payload.update(payload_data)

        return RecordMeta(
            record_id=record_id,
            owner_email=user.email,
            created_at=existing["created_at"],
            updated_at=now,
            payload=merged_payload,
        )

    async def delete_record(self, section: RecordSection, record_id: str, user: CurrentUser) -> None:
        db = await get_db()
        oid = ObjectId(record_id)
        row = await db.records.find_one(
            {"_id": oid, "owner_email": user.email, "section": section.value}
        )
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

        if row.get("storage_key"):
            try:
                get_minio_client().remove_object(
                    bucket_name=self.bucket, object_name=row["storage_key"]
                )
            except Exception:
                pass

        await db.records.delete_one({"_id": oid})

    async def download_url(self, section: RecordSection, record_id: str, user: CurrentUser) -> Dict:
        db = await get_db()
        oid = ObjectId(record_id)
        row = await db.records.find_one(
            {"_id": oid, "owner_email": user.email, "section": section.value}
        )
        if not row or not row.get("storage_key"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

        url = get_minio_client().presigned_get_object(
            bucket_name=self.bucket,
            object_name=row["storage_key"],
            expires=timedelta(hours=1),
        )
        return {"download_url": url, "original_name": row.get("original_name")}

    async def list_records(self, section: RecordSection, user: CurrentUser) -> List[Dict]:
        db = await get_db()
        cursor = (
            db.records.find({"section": section.value, "owner_email": user.email})
            .sort("created_at", -1)
            .limit(500)
        )
        return await cursor.to_list(length=500)

    async def _ensure_bucket(self) -> None:
        minio_client = get_minio_client()
        if not minio_client.bucket_exists(self.bucket):
            minio_client.make_bucket(self.bucket)

    async def _insert_record(
        self, section: RecordSection, payload_data: Dict, user: CurrentUser
    ) -> tuple[str, Dict]:
        db = await get_db()
        now = datetime.utcnow()
        normalized_payload = self._normalize_dates(payload_data)

        doc = {
            "section": section.value,
            "owner_email": user.email,
            "created_at": now,
            "updated_at": now,
            **normalized_payload,
        }
        res = await db.records.insert_one(doc)
        return str(res.inserted_id), doc

    def _normalize_dates(self, payload_data: Dict) -> Dict:
        normalized_payload: Dict = {}
        for key, value in payload_data.items():
            if isinstance(value, date) and not isinstance(value, datetime):
                normalized_payload[key] = datetime(value.year, value.month, value.day)
            else:
                normalized_payload[key] = value
        return normalized_payload


__all__ = ["RecordsService", "RecordMeta"]
