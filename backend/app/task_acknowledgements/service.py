from datetime import datetime
from typing import List, Optional

from bson import ObjectId
from fastapi import HTTPException, status

from app.db.mongo import get_db
from app.db.sync_mongo import get_sync_db
from app.models.notification import NotificationCreate
from app.repositories.notifications import NotificationRepository, create_sync_notification
from app.task_acknowledgements.models import (
    TaskAcknowledgementActionResult,
    TaskAcknowledgementOut,
    TaskAcknowledgementState,
)


TASK_ACK_COLLECTION = "task_acknowledgements"


def _display_name_from_doc(user_doc: Optional[dict], email: str) -> str:
    if not user_doc:
        return email
    first_name = (user_doc.get("first_name") or "").strip()
    last_name = (user_doc.get("last_name") or "").strip()
    full_name = " ".join(part for part in [first_name, last_name] if part).strip()
    return full_name or user_doc.get("email") or email


def _serialize_for_user(doc: dict, user_email: str) -> TaskAcknowledgementOut:
    state = doc.get("state")
    if state == TaskAcknowledgementState.PENDING_ASSIGNER.value:
        person_name = doc.get("acknowledged_by_name") or doc.get("assignee_name") or doc.get("assignee_email")
        message = f"The task acknowledged by {person_name}."
    else:
        source_label = doc.get("source_label") or "a task"
        message = f'You have been assigned a task in {source_label}: {doc.get("task_description")}'

    return TaskAcknowledgementOut(
        id=str(doc.get("_id")),
        state=TaskAcknowledgementState(state),
        source_type=doc.get("source_type") or "generic",
        source_label=doc.get("source_label") or "",
        task_description=doc.get("task_description") or "",
        assigner_email=doc.get("assigner_email") or "",
        assigner_name=doc.get("assigner_name"),
        assignee_email=doc.get("assignee_email") or "",
        assignee_name=doc.get("assignee_name"),
        acknowledged_by_email=doc.get("acknowledged_by_email"),
        acknowledged_by_name=doc.get("acknowledged_by_name"),
        message=message,
        created_at=doc.get("created_at") or datetime.utcnow(),
    )


def create_assignment_request_sync(
    *,
    assigner_email: str,
    assignee_email: str,
    task_description: str,
    source_label: str,
    source_type: str = "generic",
    assignee_name: Optional[str] = None,
) -> None:
    normalized_assigner = (assigner_email or "").strip().lower()
    normalized_assignee = (assignee_email or "").strip().lower()
    description = (task_description or "").strip()
    source = (source_label or "").strip()

    if not normalized_assigner or not normalized_assignee or not description:
        return
    if normalized_assigner == normalized_assignee:
        return

    db = get_sync_db()
    users = db.users
    assigner_doc = users.find_one({"email": normalized_assigner}, {"email": 1, "first_name": 1, "last_name": 1})
    assignee_doc = users.find_one({"email": normalized_assignee}, {"email": 1, "first_name": 1, "last_name": 1})

    resolved_assigner_name = _display_name_from_doc(assigner_doc, normalized_assigner)
    resolved_assignee_name = assignee_name or _display_name_from_doc(assignee_doc, normalized_assignee)

    create_sync_notification(
        normalized_assignee,
        f"You have been assigned a task in {source}: {description}",
        title="Task assigned",
        category="task_assignment",
    )

    db[TASK_ACK_COLLECTION].insert_one(
        {
            "assigner_email": normalized_assigner,
            "assigner_name": resolved_assigner_name,
            "assignee_email": normalized_assignee,
            "assignee_name": resolved_assignee_name,
            "task_description": description,
            "source_label": source,
            "source_type": source_type,
            "state": TaskAcknowledgementState.PENDING_ASSIGNEE.value,
            "created_at": datetime.utcnow(),
        }
    )


async def list_pending_acknowledgements_for_user(
    *,
    user_email: str,
    limit: int = 10,
) -> List[TaskAcknowledgementOut]:
    db = await get_db()
    normalized_email = (user_email or "").strip().lower()
    cursor = (
        db[TASK_ACK_COLLECTION]
        .find(
            {
                "$or": [
                    {
                        "state": TaskAcknowledgementState.PENDING_ASSIGNEE.value,
                        "assignee_email": normalized_email,
                    },
                    {
                        "state": TaskAcknowledgementState.PENDING_ASSIGNER.value,
                        "assigner_email": normalized_email,
                    },
                ]
            }
        )
        .sort("created_at", -1)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    return [_serialize_for_user(doc, normalized_email) for doc in docs]


async def acknowledge_task_request(
    *,
    acknowledgement_id: str,
    user_email: str,
) -> TaskAcknowledgementActionResult:
    if not ObjectId.is_valid(acknowledgement_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Acknowledgement not found")

    db = await get_db()
    normalized_email = (user_email or "").strip().lower()
    doc = await db[TASK_ACK_COLLECTION].find_one({"_id": ObjectId(acknowledgement_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Acknowledgement not found")

    users = db.users
    user_doc = await users.find_one(
        {"email": normalized_email},
        {"email": 1, "first_name": 1, "last_name": 1},
    )
    actor_name = _display_name_from_doc(user_doc, normalized_email)

    if (
        doc.get("state") == TaskAcknowledgementState.PENDING_ASSIGNEE.value
        and doc.get("assignee_email") == normalized_email
    ):
        await db[TASK_ACK_COLLECTION].update_one(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "state": TaskAcknowledgementState.PENDING_ASSIGNER.value,
                    "acknowledged_by_email": normalized_email,
                    "acknowledged_by_name": actor_name,
                    "assignee_acknowledged_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                }
            },
        )

        repo = NotificationRepository()
        await repo.create(
            NotificationCreate(
                user_email=doc["assigner_email"],
                title="Task acknowledged",
                message=f"The task acknowledged by {actor_name}.",
                category="task_acknowledgement",
            )
        )
        return TaskAcknowledgementActionResult(status=TaskAcknowledgementState.PENDING_ASSIGNER.value)

    if (
        doc.get("state") == TaskAcknowledgementState.PENDING_ASSIGNER.value
        and doc.get("assigner_email") == normalized_email
    ):
        await db[TASK_ACK_COLLECTION].delete_one({"_id": doc["_id"]})
        return TaskAcknowledgementActionResult(status="completed")

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot acknowledge this item")
