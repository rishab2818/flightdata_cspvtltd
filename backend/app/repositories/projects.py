# app/repositories/projects.py
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from app.db.mongo import get_db

DATA_COUNTER_KEYS = ("cfd", "wind", "flight", "others")
REPORT_COUNTER_KEYS = ("cfd", "wind", "flight")


# -----------------------------
# Helpers
# -----------------------------
def _oid(v: str | ObjectId):
    """Return ObjectId if string is valid; else return as-is."""
    return ObjectId(v) if isinstance(v, str) and ObjectId.is_valid(v) else v


def _default_data_counters() -> list[dict]:
    return [{"key": key, "count": 0} for key in DATA_COUNTER_KEYS]


def _normalize_data_counters(counters) -> list[dict]:
    counts_by_key = {key: 0 for key in DATA_COUNTER_KEYS}

    for item in counters or []:
        if not isinstance(item, dict):
            continue
        key = str(item.get("key") or "").strip().lower()
        if key not in counts_by_key:
            continue
        try:
            counts_by_key[key] = max(0, int(item.get("count") or 0))
        except (TypeError, ValueError):
            counts_by_key[key] = 0

    return [{"key": key, "count": counts_by_key[key]} for key in DATA_COUNTER_KEYS]


def _normalize(doc: dict) -> dict:
    """Normalize Mongo doc for JSON response."""
    if not doc:
        return doc
    _id = doc.get("_id")
    if isinstance(_id, ObjectId):
        doc["_id"] = str(_id)
    # normalize each member’s user_id as str
    members = []
    for m in doc.get("members", []):
        if isinstance(m, dict):
            mid = m.get("user_id")
            members.append({
                "email": m.get("email"),
                "user_id": str(mid) if isinstance(mid, ObjectId) else mid
            })
    doc["members"] = members
    doc["data_counters"] = _normalize_data_counters(doc.get("data_counters"))
    return doc


# -----------------------------
# Repository
# -----------------------------
class ProjectRepository:
    async def _resolve_users(self, emails: List[str]) -> List[dict]:
        """Resolve emails → [{'email', 'user_id'}]; drop unknown emails silently."""
        if not emails:
            return []
        db = await get_db()
        cursor = db.users.find({"email": {"$in": list(set(emails))}}, {"_id": 1, "email": 1})
        docs = await cursor.to_list(length=1000)
        return [{"email": d["email"], "user_id": d["_id"]} for d in docs]

    # -------------------------
    # CREATE
    # -------------------------
    async def create(
        self,
        name: str,
        desc: Optional[str],
        creator_email: str,
        member_emails: List[str]
    ) -> dict:
        db = await get_db()

        # ensure creator always included
        all_emails = list(dict.fromkeys([creator_email] + (member_emails or [])))
        members = await self._resolve_users(all_emails)

        doc = {
            "project_name": name,
            "project_description": desc or "",
            "members": members,  # [{email, user_id:ObjectId}]
            "data_counters": _default_data_counters(),
            "created_by": creator_email,
            "created_at": datetime.utcnow(),
        }
        res = await db.projects.insert_one(doc)
        doc["_id"] = str(res.inserted_id)
        # stringify for output
        doc["members"] = [{"email": m["email"], "user_id": str(m["user_id"])} for m in members]
        return doc

    # -------------------------
    # READ
    # -------------------------
    async def list_for_user(self, user_email: str, limit: int = 50, page: int = 1) -> List[dict]:
        db = await get_db()
        cursor = (
            db.projects.find({"members.email": user_email})
            .sort("created_at", -1)
            .skip((page - 1) * limit)
            .limit(limit)
        )
        docs = await cursor.to_list(length=limit)
        return [_normalize(d) for d in docs]

    async def count_for_user(self, user_email: str) -> int:
        db = await get_db()
        return await db.projects.count_documents({"members.email": user_email})

    async def aggregated_counts_for_user(self, user_email: str) -> dict:
        db = await get_db()
        match_query = {"members.email": user_email}

        total_projects = await db.projects.count_documents(match_query)
        pipeline = [
            {"$match": match_query},
            {"$unwind": {"path": "$data_counters", "preserveNullAndEmptyArrays": True}},
            {
                "$group": {
                    "_id": "$data_counters.key",
                    "total": {"$sum": {"$ifNull": ["$data_counters.count", 0]}},
                }
            },
        ]
        rows = await db.projects.aggregate(pipeline).to_list(length=len(DATA_COUNTER_KEYS) + 2)
        counts = {key: 0 for key in DATA_COUNTER_KEYS}
        for row in rows:
            key = str(row.get("_id") or "").strip().lower()
            if key in counts:
                counts[key] = max(0, int(row.get("total") or 0))

        report_rows = await db.report_counters.aggregate(
            [
                {"$match": {"owner_email": user_email}},
                {
                    "$group": {
                        "_id": "$dataset_type",
                        "total": {"$sum": {"$ifNull": ["$count", 0]}},
                    }
                },
            ]
        ).to_list(length=len(REPORT_COUNTER_KEYS) + 2)
        report_counts = {key: 0 for key in REPORT_COUNTER_KEYS}
        for row in report_rows:
            key = str(row.get("_id") or "").strip().lower()
            if key in report_counts:
                report_counts[key] = max(0, int(row.get("total") or 0))

        return {
            "total_projects": total_projects,
            "cfd": counts["cfd"],
            "wind": counts["wind"],
            "flight": counts["flight"],
            "others": counts["others"],
            "aero": counts["cfd"] + counts["wind"] + counts["flight"],
            "report_cfd": report_counts["cfd"],
            "report_wind": report_counts["wind"],
            "report_flight": report_counts["flight"],
            "total_reports": report_counts["cfd"] + report_counts["wind"] + report_counts["flight"],
        }

    async def increment_report_counter(
        self,
        *,
        user_email: str,
        project_id: str,
        dataset_type: str,
        tag_name: str | None = None,
        amount: int = 1,
    ) -> dict | None:
        db = await get_db()
        normalized_type = str(dataset_type or "").strip().lower()

        if normalized_type not in REPORT_COUNTER_KEYS or amount <= 0:
            return None

        pid = _oid(project_id)
        has_access = await db.projects.find_one(
            {"_id": pid, "members.email": user_email},
            {"_id": 1},
        )
        if not has_access:
            return None

        now = datetime.utcnow()
        await db.report_counters.update_one(
            {"owner_email": user_email, "dataset_type": normalized_type},
            {
                "$inc": {"count": int(amount)},
                "$set": {
                    "project_id": project_id,
                    "tag_name": tag_name,
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "owner_email": user_email,
                    "dataset_type": normalized_type,
                    "created_at": now,
                },
            },
            upsert=True,
        )

        return await db.report_counters.find_one(
            {"owner_email": user_email, "dataset_type": normalized_type}
        )

    async def get_if_member(self, project_id: str, user_email: str) -> Optional[dict]:
        db = await get_db()
        d = await db.projects.find_one({"_id": _oid(project_id), "members.email": user_email})
        return _normalize(d) if d else None

    async def increment_data_counter(
        self,
        project_id: str,
        dataset_key: str,
        actor_email: str,
        amount: int = 1,
    ) -> Optional[dict]:
        db = await get_db()
        pid = _oid(project_id)
        normalized_key = str(dataset_key or "").strip().lower()
        if normalized_key not in DATA_COUNTER_KEYS:
            return None
        if amount <= 0:
            doc = await db.projects.find_one({"_id": pid, "members.email": actor_email})
            return _normalize(doc) if doc else None

        has_access = await db.projects.find_one({"_id": pid, "members.email": actor_email}, {"_id": 1})
        if not has_access:
            return None

        await db.projects.update_one(
            {"_id": pid, "data_counters.key": {"$ne": normalized_key}},
            {"$push": {"data_counters": {"key": normalized_key, "count": 0}}},
        )
        await db.projects.update_one(
            {"_id": pid, "data_counters.key": normalized_key},
            {
                "$inc": {"data_counters.$.count": int(amount)},
                "$set": {"updated_at": datetime.utcnow()},
            },
        )

        doc = await db.projects.find_one({"_id": pid})
        return _normalize(doc) if doc else None

    # -------------------------
    # UPDATE (description only)
    # -------------------------
    async def update_main(
        self,
        project_id: str,
        desc: Optional[str],
        actor_email: str
    ) -> Optional[dict]:
        """Allowed only if actor is a member (router ensures GD/DH)."""
        db = await get_db()
        has = await db.projects.find_one({"_id": _oid(project_id), "members.email": actor_email})
        if not has:
            return None

        updates = {}
        if desc is not None:
            updates["project_description"] = desc
        if updates:
            updates["updated_at"] = datetime.utcnow()
            await db.projects.update_one({"_id": _oid(project_id)}, {"$set": updates})

        d = await db.projects.find_one({"_id": _oid(project_id)})
        return _normalize(d) if d else None

    # -------------------------
    # PATCH MEMBERS
    # -------------------------
    async def patch_members(
        self,
        project_id: str,
        add_emails: List[str],
        remove_emails: List[str],
        actor_email: str
    ) -> Optional[dict]:
        """
        Add/remove members.
        - Actor must already be a member.
        - Do $pull then $addToSet separately (to avoid Mongo path conflict).
        """
        db = await get_db()
        pid = _oid(project_id)

        # check actor membership
        if not await db.projects.find_one({"_id": pid, "members.email": actor_email}):
            return None

        # 1️⃣ REMOVE members first
        if remove_emails:
            unique_remove = list(dict.fromkeys([e for e in remove_emails if isinstance(e, str)]))
            if unique_remove:
                await db.projects.update_one(
                    {"_id": pid},
                    {"$pull": {"members": {"email": {"$in": unique_remove}}}},
                )

        # 2️⃣ ADD new members
        if add_emails:
            resolved = await self._resolve_users(add_emails)
            for r in resolved:
                r["user_id"] = _oid(r["user_id"])
            if resolved:
                await db.projects.update_one(
                    {"_id": pid},
                    {"$addToSet": {"members": {"$each": resolved}}},
                )

        # return updated project
        doc = await db.projects.find_one({"_id": pid})
        return _normalize(doc) if doc else None

    # -------------------------
    # DELETE
    # -------------------------
    async def delete(self, project_id: str, actor_email: str) -> bool:
        """Only if actor is a member (router also enforces GD/DH)."""
        db = await get_db()
        pid = _oid(project_id)
        has = await db.projects.find_one({"_id": pid, "members.email": actor_email})
        if not has:
            return False
        res = await db.projects.delete_one({"_id": pid})
        return bool(res.deleted_count)
