import hashlib
import secrets
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.api_keys.models import ApiKey


def generate_plain_api_key() -> str:
    return f"orx_{secrets.token_urlsafe(32)}"


def hash_api_key(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


async def list_user_api_keys(db: AsyncSession, user_id: str) -> list[ApiKey]:
    result = await db.execute(
        select(ApiKey).where(ApiKey.user_id == user_id).order_by(ApiKey.created_at.desc())
    )
    return result.scalars().all()


async def list_all_api_keys(db: AsyncSession) -> list[ApiKey]:
    result = await db.execute(select(ApiKey).order_by(ApiKey.created_at.desc()))
    return result.scalars().all()


async def list_active_user_api_keys(db: AsyncSession, user_id: str) -> list[ApiKey]:
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.user_id == user_id, ApiKey.status == "active")
        .order_by(ApiKey.created_at.desc())
    )
    return result.scalars().all()


async def list_active_user_api_keys_for_chain(
    db: AsyncSession, user_id: str, chain_id: str
) -> list[ApiKey]:
    result = await db.execute(
        select(ApiKey)
        .where(
            ApiKey.user_id == user_id,
            ApiKey.chain_id == chain_id,
            ApiKey.status == "active",
        )
        .order_by(ApiKey.created_at.desc())
    )
    return result.scalars().all()


async def get_api_key(db: AsyncSession, api_key_id: str, user_id: str) -> ApiKey | None:
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == api_key_id, ApiKey.user_id == user_id)
    )
    return result.scalar_one_or_none()


def mark_key_revoked(api_key: ApiKey) -> None:
    api_key.status = "revoked"
    api_key.revoked_at = datetime.now(timezone.utc)
