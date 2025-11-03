import asyncio
from datetime import datetime
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.models.user import Role

load_dotenv()

async def main():
    client = AsyncIOMotorClient(settings.mongo_uri)
    db = client[settings.mongo_db]

    await db.users.create_index("email", unique=True)

    admin_email = "admin@example.com"
    doc = {
        "first_name": "Admin",
        "last_name": "User",
        "email": admin_email,
        "password": "admin",
        "role": Role.ADMIN.value,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "last_login_at": None,
    }

    await db.users.update_one({"email": admin_email}, {"$set": doc}, upsert=True)
    print(f"Seeded admin: {admin_email} / password=admin")

if __name__ == "__main__":
    asyncio.run(main())
