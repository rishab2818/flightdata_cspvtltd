# app/models/project.py
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

class ProjectCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    members: List[str] = []  # usernames

class ProjectInDB(BaseModel):
    id: str | None = Field(None, alias="_id")
    title: str
    description: str = ""
    members: List[str] = []
    created_at: datetime

class ProjectOut(BaseModel):
    id: str | None = Field(None, alias="_id")
    title: str
    description: str = ""
    members: List[str] = []
    created_at: datetime
