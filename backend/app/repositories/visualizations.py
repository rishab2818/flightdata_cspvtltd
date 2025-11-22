from datetime import datetime
from typing import List, Optional

from bson import ObjectId

from app.db.mongo import get_db


class VisualizationRepository:
    collection_name = "visualizations"

    async def create(
        self,
        project_id: str,
        owner_email: str,
        name: str,
        description: str | None,
        series: list[dict],
        chunk_size: int,
    ) -> str:
        db = await get_db()
        now = datetime.utcnow()
        viz_id = ObjectId()
        doc = {
            "_id": viz_id,
            "project_id": project_id,
            "owner_email": owner_email,
            "name": name,
            "description": description,
            "series": series,
            "status": "queued",
            "progress": 0,
            "chunk_size": chunk_size,
            "chunk_count": 0,
            "rows_total": 0,
            "trace_labels": [],
            "chunk_prefix": f"visualizations/{project_id}/{viz_id}",
            "image_format": "png",
            "created_at": now,
            "updated_at": now,
        }
        await db[self.collection_name].insert_one(doc)
        return str(viz_id)

    async def update(self, viz_id: str, **fields):
        db = await get_db()
        fields["updated_at"] = datetime.utcnow()
        await db[self.collection_name].update_one(
            {"_id": ObjectId(viz_id)}, {"$set": fields}
        )

    async def get(self, viz_id: str) -> Optional[dict]:
        db = await get_db()
        doc = await db[self.collection_name].find_one({"_id": ObjectId(viz_id)})
        if not doc:
            return None
        doc["viz_id"] = str(doc["_id"])
        doc.pop("_id", None)
        return doc

    async def list_for_project(self, project_id: str) -> List[dict]:
        db = await get_db()
        cursor = (
            db[self.collection_name]
            .find({"project_id": project_id})
            .sort("created_at", -1)
            .limit(50)
        )
        docs = await cursor.to_list(length=50)
        for d in docs:
            d["viz_id"] = str(d["_id"])
            d.pop("_id", None)
        return docs

    async def delete(self, viz_id: str) -> bool:
        db = await get_db()
        res = await db[self.collection_name].delete_one({"_id": ObjectId(viz_id)})
        return bool(res.deleted_count)
