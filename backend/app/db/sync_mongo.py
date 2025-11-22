from functools import lru_cache
from pymongo import MongoClient
from app.core.config import settings


@lru_cache(maxsize=1)
def get_sync_db():
    client = MongoClient(settings.mongo_uri)
    return client[settings.mongo_db]
