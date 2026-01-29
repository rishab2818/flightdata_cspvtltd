import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from enum import Enum


# --- Direct config here ---
MONGO_URI = "mongodb://127.0.0.1:27017"
MONGO_DB = "flightdv"


# --- Define Role enum directly (if you need it) ---
class Role(str, Enum):
    ADMIN = "ADMIN"
    USER = "user"


async def main():
    client = AsyncIOMotorClient(MONGO_URI)
    # db = client[MONGO_DB]   
    db = client[MONGO_DB]

    # Ensure unique email index
    await db.users.create_index("email", unique=True)

    admin_email = "admin@example.com"
    doc = {
        "first_name": "Admin",
        "last_name": "User",
        "email": admin_email,
        "password": "admin",  # You may want to hash later
        "role": Role.ADMIN.value,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "last_login_at": None,
    }

    await db.users.update_one({"email": admin_email}, {"$set": doc}, upsert=True)
    print(f"Seeded admin: {admin_email} / password=admin")


if __name__ == "__main__":
    asyncio.run(main())
