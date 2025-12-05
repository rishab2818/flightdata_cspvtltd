from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict

# Your base persisted model (Mongo doc)
class Project(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    project_name: str = Field(..., min_length=2, max_length=100)
    project_description: Optional[str] = Field(None, max_length=1000)
    # store members as objects for future-proofing: {"email":..., "user_id": "..."}
    members: List[dict] = Field(default_factory=list)
    created_by: str = Field(..., description="Creator's email")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


# --------- Schemas used by the router ---------

class ProjectMember(BaseModel):
    email: str
    user_id: str

class ProjectCreate(BaseModel):
    project_name: str
    project_description: Optional[str] = None
    # accept emails from client; we’ll resolve to {email, user_id} server-side
    member_emails: List[str] = Field(default_factory=list)

class ProjectOut(BaseModel):
    id: str = Field(alias="_id")
    project_name: str
    project_description: Optional[str] = None
    members: List[ProjectMember]
    created_by: str
    created_at: datetime

    model_config = ConfigDict(populate_by_name=True)

class ProjectUpdate(BaseModel):
    project_name: Optional[str] = None
    project_description: Optional[str] = None

class MembersPatch(BaseModel):
    add_emails: List[str] = Field(default_factory=list)
    remove_emails: List[str] = Field(default_factory=list)
