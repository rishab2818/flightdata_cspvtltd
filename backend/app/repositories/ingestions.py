from datetime import datetime
from typing import List, Optional
from bson import ObjectId
from app.db.mongo import get_db


class IngestionRepository:
    collection_name = "ingestion_jobs"

    async def create_job(
        self,
        project_id: str,
        filename: str,
        storage_key: str,
        owner_email: str,
    ) -> str:
        db = await get_db()
        now = datetime.utcnow()
        doc = {
            "project_id": project_id,
            "filename": filename,
            "storage_key": storage_key,
            "status": "queued",
            "progress": 0,
            "owner_email": owner_email,
            "created_at": now,
            "updated_at": now,
        }
        res = await db[self.collection_name].insert_one(doc)
        return str(res.inserted_id)

    async def update_job(self, job_id: str, **fields):
        db = await get_db()
        fields["updated_at"] = datetime.utcnow()
        await db[self.collection_name].update_one(
            {"_id": ObjectId(job_id)}, {"$set": fields}
        )

    async def get_job(self, job_id: str) -> Optional[dict]:
        db = await get_db()
        doc = await db[self.collection_name].find_one({"_id": ObjectId(job_id)})
        if not doc:
            return None
        doc["job_id"] = str(doc["_id"])
        doc.pop("_id", None)
        return doc

    async def list_for_project(self, project_id: str) -> List[dict]:
        db = await get_db()
        cursor = (
            db[self.collection_name]
            .find({"project_id": project_id})
            .sort("created_at", -1)
            .limit(25)
        )
        docs = await cursor.to_list(length=25)
        for d in docs:
            d["job_id"] = str(d["_id"])
            d.pop("_id", None)
        return docs
