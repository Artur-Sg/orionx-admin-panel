from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Body, Header, HTTPException, status
from sqlalchemy import update
from sqlalchemy.dialects.postgresql import insert

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.modules.api_keys.models import ApiKey, ApiKeyUsageEvent

router = APIRouter()


def _iter_events(payload: Any):
    if isinstance(payload, list):
        for item in payload:
            yield from _iter_events(item)
        return
    if isinstance(payload, dict):
        if "consumer_name" in payload and "status" in payload:
            yield payload
        for value in payload.values():
            if isinstance(value, (list, dict)):
                yield from _iter_events(value)


@router.post("/internal/usage/apisix", status_code=status.HTTP_202_ACCEPTED)
async def ingest_apisix_usage(
    payload: Any = Body(...),
    x_usage_token: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict[str, int]:
    expected = settings.apisix_usage_sink_token
    if not expected:
        raise HTTPException(status_code=503, detail="Usage sink token is not configured")
    provided = x_usage_token
    if not provided and authorization:
        provided = authorization.removeprefix("Bearer ").strip()
    if provided != expected:
        raise HTTPException(status_code=401, detail="Invalid usage token")

    accepted = 0
    deduped = 0

    async with AsyncSessionLocal() as db:
        for event in _iter_events(payload):
            consumer_name = str(event.get("consumer_name") or "")
            if not consumer_name.startswith("key-"):
                continue

            api_key_id_raw = consumer_name.removeprefix("key-")
            try:
                api_key_id = UUID(api_key_id_raw)
            except ValueError:
                continue

            status_raw = event.get("status")
            try:
                status_code = int(status_raw)
            except (TypeError, ValueError):
                continue

            request_id = str(event.get("request_id") or "").strip()
            if not request_id:
                continue

            # limit-count rejects should not consume user quota.
            if status_code == 429:
                continue

            insert_stmt = (
                insert(ApiKeyUsageEvent)
                .values(
                    request_id=request_id,
                    api_key_id=api_key_id,
                    status_code=status_code,
                )
                .on_conflict_do_nothing(index_elements=["request_id"])
            )
            insert_res = await db.execute(insert_stmt)
            if insert_res.rowcount == 0:
                deduped += 1
                continue

            await db.execute(
                update(ApiKey)
                .where(ApiKey.id == api_key_id)
                .values(quota_used=ApiKey.quota_used + 1)
            )
            accepted += 1

        await db.commit()

    return {"accepted": accepted, "deduped": deduped}
