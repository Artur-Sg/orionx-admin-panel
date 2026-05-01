import asyncio
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.core.config import settings
from app.integrations.apisix import (
    delete_chain_route,
    delete_consumer,
    upsert_chain_route,
    upsert_consumer_api_key,
)
from app.modules.chains.models import Chain
from app.modules.sync.models import SyncTask


async def _process_sync_task(task_id: str) -> None:
    # Create a dedicated async engine/session per task to avoid cross-loop issues.
    engine = create_async_engine(str(settings.database_url), echo=False, pool_pre_ping=True)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as db:
        task = await db.get(SyncTask, task_id)
        if task is None or task.status == "done":
            await engine.dispose()
            return

        task.status = "in_progress"
        task.attempts += 1
        await db.commit()

        try:
            if task.task_type == "chain_upsert":
                chain_id = task.payload.get("chain_id")
                if not chain_id:
                    raise ValueError("Missing chain_id in task payload")
                result = await db.execute(select(Chain).where(Chain.id == chain_id))
                chain = result.scalar_one_or_none()
                if chain is None:
                    raise ValueError("Chain not found")
                await upsert_chain_route(chain)
                chain.sync_status = "synced"
                chain.sync_error = None
                chain.synced_at = datetime.now(timezone.utc)
                chain.last_sync_attempt_at = datetime.now(timezone.utc)

            elif task.task_type == "chain_delete":
                code = task.payload.get("code")
                if not code:
                    raise ValueError("Missing code in task payload")
                fake_chain = Chain(code=code, name=code, rpc_target_url="http://localhost")
                await delete_chain_route(fake_chain)

            elif task.task_type == "api_key_upsert":
                api_key_id = task.payload.get("api_key_id")
                plain_key = task.payload.get("plain_key")
                status_value = task.payload.get("status")
                if not api_key_id:
                    raise ValueError("Missing api_key_id in task payload")
                if status_value == "active" and plain_key:
                    await upsert_consumer_api_key(api_key_id, plain_key)
                elif status_value == "revoked":
                    await delete_consumer(api_key_id)
                else:
                    raise ValueError("Invalid api_key_upsert payload")

            else:
                raise ValueError(f"Unknown task type: {task.task_type}")

            task.status = "done"
            task.last_error = None
            await db.commit()
        except Exception as exc:
            if task.task_type == "chain_upsert":
                chain_id = task.payload.get("chain_id")
                if chain_id:
                    result = await db.execute(select(Chain).where(Chain.id == chain_id))
                    chain = result.scalar_one_or_none()
                    if chain is not None:
                        chain.sync_status = "failed"
                        chain.sync_error = str(exc)
                        chain.synced_at = None
                        chain.last_sync_attempt_at = datetime.now(timezone.utc)
            task.status = "failed"
            task.last_error = str(exc)
            await db.commit()
            await engine.dispose()
            raise
        await engine.dispose()


def process_sync_task(task_id: str) -> None:
    asyncio.run(_process_sync_task(task_id))
