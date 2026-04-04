from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.chains.models import Chain, UserChainAccess
from app.integrations.apisix import chain_route_exists
from app.modules.sync.service import create_sync_task
from app.workers.queue import get_queue


async def list_chains(
    db: AsyncSession,
    search: str | None,
    limit: int,
    offset: int,
    sort_by: str | None,
    sort_order: str | None,
    status: str | None,
    visibility: str | None,
):
    query = select(Chain)
    if search:
        query = query.where(Chain.name.ilike(f"%{search}%") | Chain.code.ilike(f"%{search}%"))
    if status:
        query = query.where(Chain.status == status)
    if visibility:
        query = query.where(Chain.visibility == visibility)

    sort_map = {
        "name": Chain.name,
        "code": Chain.code,
        "status": Chain.status,
        "visibility": Chain.visibility,
        "sort_order": Chain.sort_order,
        "created_at": Chain.created_at,
        "updated_at": Chain.updated_at,
    }
    if sort_by in sort_map:
        column = sort_map[sort_by]
        if sort_order == "desc":
            query = query.order_by(column.desc())
        else:
            query = query.order_by(column.asc())
    else:
        query = query.order_by(Chain.sort_order, Chain.name)

    total_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(total_query)).scalar_one()

    result = await db.execute(query.limit(limit).offset(offset))
    items = result.scalars().all()

    await _auto_resync_failed_chains(db)
    await _check_synced_chains(db)

    return items, total


async def get_chain_by_code(db: AsyncSession, code: str) -> Chain | None:
    result = await db.execute(select(Chain).where(Chain.code == code))
    return result.scalar_one_or_none()


async def list_user_access(db: AsyncSession, user_id):
    result = await db.execute(select(UserChainAccess).where(UserChainAccess.user_id == user_id))
    return result.scalars().all()


async def _auto_resync_failed_chains(db: AsyncSession) -> None:
    now = datetime.now(timezone.utc)
    threshold = now - timedelta(minutes=10)

    result = await db.execute(
        select(Chain).where(
            Chain.sync_status == "failed",
            or_(Chain.last_sync_attempt_at.is_(None), Chain.last_sync_attempt_at < threshold),
        )
    )
    chains = result.scalars().all()
    if not chains:
        return

    queue = get_queue()
    for chain in chains:
        chain.sync_status = "pending"
        chain.sync_error = None
        chain.last_sync_attempt_at = now
        task = await create_sync_task(db, "chain_upsert", {"chain_id": str(chain.id)})
        await db.commit()
        queue.enqueue("app.workers.tasks.process_sync_task", str(task.id))


async def _check_synced_chains(db: AsyncSession) -> None:
    now = datetime.now(timezone.utc)
    threshold = now - timedelta(minutes=10)

    result = await db.execute(
        select(Chain).where(
            Chain.sync_status == "synced",
            or_(Chain.last_sync_attempt_at.is_(None), Chain.last_sync_attempt_at < threshold),
        )
    )
    chains = result.scalars().all()
    if not chains:
        return

    queue = get_queue()
    for chain in chains:
        try:
            exists = await chain_route_exists(chain.code)
        except Exception:
            # If APISIX is unavailable, do not flip status.
            continue
        chain.last_sync_attempt_at = now
        if not exists:
            chain.sync_status = "pending"
            chain.sync_error = "Route missing in APISIX"
            task = await create_sync_task(db, "chain_upsert", {"chain_id": str(chain.id)})
            await db.commit()
            queue.enqueue("app.workers.tasks.process_sync_task", str(task.id))
        else:
            await db.commit()
