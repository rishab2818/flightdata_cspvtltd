from datetime import datetime
from typing import List, Optional

from bson import ObjectId

from app.db.mongo import get_db
from app.db.sync_mongo import get_sync_db
from app.models.notification import NotificationCreate, NotificationOut


class NotificationRepository:
    collection = "notifications"

    def _normalize(self, doc: dict) -> NotificationOut:
        return NotificationOut(
            id=str(doc.get("_id")),
            user_email=doc["user_email"],
            title=doc.get("title"),
            message=doc.get("message"),
            category=doc.get("category", "general"),
            link=doc.get("link"),
            is_read=doc.get("is_read", False),
            created_at=doc.get("created_at") or datetime.utcnow(),
        )

    async def create(self, payload: NotificationCreate) -> NotificationOut:
        db = await get_db()
        doc = payload.model_dump()
        doc["is_read"] = False
        doc["created_at"] = datetime.utcnow()
        res = await db[self.collection].insert_one(doc)
        doc["_id"] = res.inserted_id
        return self._normalize(doc)

    async def list_for_user(self, user_email: str, limit: int = 25) -> List[NotificationOut]:
        db = await get_db()
        cursor = (
            db[self.collection]
            .find({"user_email": user_email})
            .sort("created_at", -1)
            .limit(limit)
        )
        docs = await cursor.to_list(length=limit)
        return [self._normalize(doc) for doc in docs]

    async def mark_as_read(self, notification_id: str, user_email: str) -> bool:
        db = await get_db()
        res = await db[self.collection].update_one(
            {"_id": ObjectId(notification_id), "user_email": user_email},
            {"$set": {"is_read": True, "read_at": datetime.utcnow()}},
        )
        return res.modified_count > 0

    async def mark_all_as_read(self, user_email: str) -> int:
        db = await get_db()
        res = await db[self.collection].update_many(
            {"user_email": user_email, "is_read": False},
            {"$set": {"is_read": True, "read_at": datetime.utcnow()}},
        )
        return res.modified_count

    async def delete_for_user(self, notification_id: str, user_email: str) -> bool:
        db = await get_db()
        res = await db[self.collection].delete_one(
            {"_id": ObjectId(notification_id), "user_email": user_email}
        )
        return res.deleted_count > 0

    async def delete_all_for_user(self, user_email: str) -> int:
        db = await get_db()
        res = await db[self.collection].delete_many({"user_email": user_email})
        return res.deleted_count


def create_sync_notification(
    user_email: str,
    message: str,
    *,
    title: Optional[str] = None,
    category: str = "general",
    link: Optional[str] = None,
) -> None:
    """Create a notification in sync contexts (e.g., Celery tasks)."""

    if not user_email:
        return

    db = get_sync_db()
    db[NotificationRepository.collection].insert_one(
        {
            "user_email": user_email,
            "title": title,
            "message": message,
            "category": category,
            "link": link,
            "is_read": False,
            "created_at": datetime.utcnow(),
        }
    )
