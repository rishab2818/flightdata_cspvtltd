# app/db/mongo.py
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings

client: AsyncIOMotorClient | None = None
db: AsyncIOMotorDatabase | None = None

async def connect_to_mongo():
    """
    Establish a real connection and verify with a ping.
    """
    global client, db
    client = AsyncIOMotorClient(
        settings.mongo_uri,
        serverSelectionTimeoutMS=3000,  # fail fast if unreachable
    )
    candidate = client[settings.mongo_db]

    # Force a real round-trip so we know it's truly connected
    await candidate.command("ping")

    # Ensure index (safe to call multiple times)
    await candidate.users.create_index("username", unique=True)

    db = candidate

async def get_db() -> AsyncIOMotorDatabase:
    """
    Returns an initialized database handle, connecting if needed.
    """
    global db
    if db is None:
        await connect_to_mongo()
    return db

async def close_mongo_connection():
    global client, db
    if client:
        client.close()
    client = None
    db = None
