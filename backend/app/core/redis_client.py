from functools import lru_cache
from redis.asyncio import Redis
from redis import Redis as SyncRedis

from app.core.config import settings


@lru_cache(maxsize=1)
def get_async_redis() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)


@lru_cache(maxsize=1)
def get_sync_redis() -> SyncRedis:
    return SyncRedis.from_url(settings.redis_url, decode_responses=True)
