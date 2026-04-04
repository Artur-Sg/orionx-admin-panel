from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.sync.models import SyncTask


async def create_sync_task(db: AsyncSession, task_type: str, payload: dict) -> SyncTask:
    task = SyncTask(task_type=task_type, payload=payload, status="pending")
    db.add(task)
    await db.flush()
    return task
