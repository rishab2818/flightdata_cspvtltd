# app/repositories/projects.py
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from app.db.mongo import get_db
from app.models.project import ProjectCreate, ProjectOut

def _normalize(doc: dict) -> dict:
    if not doc:
        return doc
    _id = doc.get("_id")
    if isinstance(_id, ObjectId):
        doc["_id"] = str(_id)
    doc.setdefault("id", doc["_id"])
    doc.setdefault("members", doc.get("members", []))
    return doc

def _flex_id(pid: str):
    return ObjectId(pid) if ObjectId.is_valid(pid) else pid

class ProjectRepository:
    async def create(self, data: ProjectCreate, creator_username: str) -> ProjectOut:
        db = await get_db()
        # always include creator in members
        base_members = list(dict.fromkeys([creator_username] + (data.members or [])))
        doc = {
            "title": data.title,
            "description": data.description or "",
            "members": base_members,
            "created_at": datetime.utcnow(),
        }
        res = await db.projects.insert_one(doc)
        doc["_id"] = str(res.inserted_id)
        doc["id"] = doc["_id"]
        return ProjectOut(**doc)

    async def list_for_member(self, username: str, limit: int = 50, page: int = 1) -> List[ProjectOut]:
        db = await get_db()
        cursor = (
            db.projects.find({"members": username})
            .sort("created_at", -1)
            .skip((page - 1) * limit)
            .limit(limit)
        )
        docs = [_normalize(d) for d in await cursor.to_list(length=limit)]
        return [ProjectOut(**d) for d in docs]

    async def count_for_member(self, username: str) -> int:
        db = await get_db()
        return await db.projects.count_documents({"members": username})

    async def get_if_member(self, project_id: str, username: str) -> Optional[ProjectOut]:
        db = await get_db()
        doc = await db.projects.find_one({"_id": _flex_id(project_id), "members": username})
        return ProjectOut(**_normalize(doc)) if doc else None

    async def update_members(self, project_id: str, add: List[str], remove: List[str], username_scope: str) -> Optional[ProjectOut]:
        """
        Only allow update if the acting user (username_scope) is currently a member of the project.
        """
        db = await get_db()
        # guard: acting user must be a member of this project
        has = await db.projects.find_one({"_id": _flex_id(project_id), "members": username_scope})
        if not has:
            return None

        ops = {}
        if add:
            ops.setdefault("$addToSet", {})["members"] = {"$each": list(dict.fromkeys(add))}
        if remove:
            ops.setdefault("$pull", {})["members"] = {"$in": list(dict.fromkeys(remove))}
        if ops:
            await db.projects.update_one({"_id": _flex_id(project_id)}, ops)
        doc = await db.projects.find_one({"_id": _flex_id(project_id)})
        return ProjectOut(**_normalize(doc)) if doc else None

    async def remove_member_everywhere(self, username: str):
        db = await get_db()
        await db.projects.update_many({}, {"$pull": {"members": username}})
