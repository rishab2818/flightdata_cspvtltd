from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, EmailStr, Field

class Role(str, Enum):
    ADMIN = "ADMIN"
    GD = "GD"
    DH = "DH"
    TL = "TL"
    SM = "SM"
    OIC = "OIC"
    JRF = "JRF"
    SRF = "SRF"
    CE = "CE"
    STUDENT = "STUDENT"

ACCESS_LEVEL = {
    Role.ADMIN: 1,
    Role.GD: 2,
    Role.DH: 3,
    Role.TL: 4,
    Role.SM: 5,
    Role.OIC: 6,
    Role.JRF: 7,
    Role.SRF: 8,
    Role.CE: 9,
    Role.STUDENT: 10,
}

def get_access_level(role: Role) -> int:
    return ACCESS_LEVEL.get(role, 99)

class User(BaseModel):
    first_name: str = Field(...)
    last_name: Optional[str] = None
    email: EmailStr = Field(...)
    password: str = Field(...)
    role: Role
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login_at: Optional[datetime] = None

    def access_level_value(self) -> int:
        return get_access_level(self.role)
