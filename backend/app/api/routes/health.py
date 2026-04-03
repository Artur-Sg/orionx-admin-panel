from fastapi import APIRouter
import httpx
from redis import Redis

from app.core.config import settings

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.get("/health/redis")
def health_redis() -> dict:
    try:
        redis = Redis.from_url(settings.redis_url)
        redis.ping()
        return {"status": "ok"}
    except Exception as exc:
        return {"status": "error", "detail": str(exc)}


@router.get("/health/apisix")
async def health_apisix() -> dict:
    if not settings.apisix_admin_url or not settings.apisix_admin_key:
        return {"status": "error", "detail": "APISIX admin config missing"}

    url = f"{settings.apisix_admin_url.rstrip('/')}/apisix/admin/routes"
    headers = {"X-API-KEY": settings.apisix_admin_key}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, headers=headers)
        if resp.status_code == 200:
            return {"status": "ok"}
        return {"status": "error", "detail": f"HTTP {resp.status_code}"}
    except Exception as exc:
        return {"status": "error", "detail": str(exc)}
