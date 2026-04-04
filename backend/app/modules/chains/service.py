from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.chains.models import Chain, UserChainAccess


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
    return result.scalars().all(), total


async def get_chain_by_code(db: AsyncSession, code: str) -> Chain | None:
    result = await db.execute(select(Chain).where(Chain.code == code))
    return result.scalar_one_or_none()


async def list_user_access(db: AsyncSession, user_id):
    result = await db.execute(select(UserChainAccess).where(UserChainAccess.user_id == user_id))
    return result.scalars().all()
