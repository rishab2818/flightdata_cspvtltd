from datetime import datetime
from typing import List, Optional

from bson import ObjectId

from app.db.mongo import get_db


class VisualizationRepository:
    collection_name = "visualizations"

    async def create(
        self,
        project_id: str,
        chart_type: str,
        owner_email: str,
        series: list[dict],
        filename: str | None = None,
        source_type: str = "tabular",
        mat_request: dict | None = None,
        dataset_type: str | None = None,
        tag_name: str | None = None,
        is_saved: bool = False,
    ) -> str:
        db = await get_db()
        now = datetime.utcnow()

        doc = {
            "project_id": project_id,
            "dataset_type": dataset_type,
            "tag_name": tag_name,
            "source_type": source_type,
            "chart_type": chart_type,
            "series": series,
            "mat_request": mat_request,
            "filename": filename,
            "status": "queued",
            "progress": 0,
            "owner_email": owner_email,
            "is_saved": is_saved,
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

    async def mark_saved(self, viz_id: str) -> Optional[dict]:
        db = await get_db()
        await db[self.collection_name].update_one(
            {"_id": ObjectId(viz_id)},
            {
                "$set": {
                    "is_saved": True,
                    "updated_at": datetime.utcnow(),
                }
            },
        )
        return await self.get(viz_id)

    async def list_for_project(
        self,
        project_id: str,
        page: int = 1,
        limit: int = 30,
        saved_only: bool = False,
    ) -> List[dict]:
        db = await get_db()

        query = {"project_id": project_id}
        if saved_only:
            query["is_saved"] = True

        cursor = (
            db[self.collection_name]
            .find(query)
            .sort("created_at", -1)
            .skip((page - 1) * limit)
            .limit(limit)
        )
        docs = await cursor.to_list(length=limit)
        for doc in docs:
            doc["viz_id"] = str(doc["_id"])
            doc.pop("_id", None)
        return docs

    async def delete(self, viz_id: str) -> None:
        db = await get_db()
        await db[self.collection_name].delete_one({"_id": ObjectId(viz_id)})