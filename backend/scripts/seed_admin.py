import sys, pathlib
sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

import asyncio
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings
from app.core.security import hash_password
from app.models.user import Role

load_dotenv()

async def main():
    client = AsyncIOMotorClient(settings.mongo_uri)
    db = client[settings.mongo_db]
    await db.users.create_index("username", unique=True)

    doc = {
        "username": "admin",
        "password_hash": hash_password("admin"),
        "role": Role.ADMIN,
    }

    # upsert: update password & role if admin exists, or create it
    await db.users.update_one(
        {"username": "admin"},
        {"$set": doc},
        upsert=True
    )
    print("seeded/updated admin: username=admin password=admin (PBKDF2-SHA256)")

if __name__ == "__main__":
    asyncio.run(main())
