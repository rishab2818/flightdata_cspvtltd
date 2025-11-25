from datetime import datetime
from typing import List, Optional

from bson import ObjectId

from app.db.mongo import get_db


class VisualizationRepository:
    collection_name = "visualizations"

    async def create(
        self,
        project_id: str,
        x_axis: str,
        chart_type: str,
        owner_email: str,
        series: list[dict],
        filename: str | None = None,
    ) -> str:
        db = await get_db()
        now = datetime.utcnow()
        doc = {
            "project_id": project_id,
            "x_axis": x_axis,
            "chart_type": chart_type,
            "series": series,
            "filename": filename,
            "status": "queued",
            "progress": 0,
            "owner_email": owner_email,
            "created_at": now,
            "updated_at": now,
        }
        res = await db[self.collection_name].insert_one(doc)
        return str(res.inserted_id)

    async def update(self, viz_id: str, **fields):
        db = await get_db()
        fields["updated_at"] = datetime.utcnow()
        await db[self.collection_name].update_one({"_id": ObjectId(viz_id)}, {"$set": fields})

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
        for doc in docs:
            doc["viz_id"] = str(doc["_id"])
            doc.pop("_id", None)
        return docs

    async def delete(self, viz_id: str) -> None:
        db = await get_db()
        await db[self.collection_name].delete_one({"_id": ObjectId(viz_id)})
