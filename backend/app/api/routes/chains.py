from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.auth.deps import CurrentUser, get_current_context, require_role
from app.modules.chains.models import Chain, UserChainAccess
from app.modules.chains.schemas import (
    ChainCreate,
    ChainListResponse,
    ChainRead,
    ChainUpdate,
    UserChainAccessCreate,
    UserChainAccessCreateByEmail,
    UserChainAccessRead,
    UserChainAccessUpdate,
    PublicChainListResponse,
    PublicChainRead,
    UserChainListResponse,
    UserChainRead,
)
from app.modules.chains.service import list_chains
from app.modules.users.models import User
from app.modules.sync.service import create_sync_task
from app.workers.queue import get_queue

router = APIRouter()


@router.get("/admin/chains", response_model=ChainListResponse)
async def admin_list_chains(
    db: AsyncSession = Depends(get_db),
    _ctx: CurrentUser = Depends(require_role("admin")),
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
    sort_by: str | None = None,
    sort_order: str | None = None,
    status: str | None = None,
    visibility: str | None = None,
) -> ChainListResponse:
    items, total = await list_chains(
        db, search, limit, offset, sort_by, sort_order, status, visibility
    )
    return ChainListResponse(items=[ChainRead.model_validate(c) for c in items], total=total)


@router.post("/admin/chains", response_model=ChainRead)
async def admin_create_chain(
    payload: ChainCreate,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUser = Depends(require_role("admin")),
) -> ChainRead:
    existing = await db.execute(select(Chain).where(Chain.code == payload.code))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Chain code already exists")
    chain = Chain(
        code=payload.code,
        name=payload.name,
        status=payload.status,
        visibility=payload.visibility,
        rpc_target_url=payload.rpc_target_url,
        description=payload.description,
        sort_order=payload.sort_order,
        created_by=ctx.user.id,
        sync_status="pending",
        sync_error=None,
    )
    db.add(chain)
    await db.commit()
    task = await create_sync_task(db, "chain_upsert", {"chain_id": str(chain.id)})
    await db.commit()
    try:
        get_queue().enqueue("app.workers.tasks.process_sync_task", str(task.id))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Enqueue failed: {exc}") from exc
    return ChainRead.model_validate(chain)


@router.put("/admin/chains/{chain_id}", response_model=ChainRead)
async def admin_update_chain(
    chain_id: UUID,
    payload: ChainUpdate,
    db: AsyncSession = Depends(get_db),
    _ctx: CurrentUser = Depends(require_role("admin")),
) -> ChainRead:
    chain = await db.get(Chain, chain_id)
    if chain is None:
        raise HTTPException(status_code=404, detail="Chain not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(chain, field, value)
    chain.sync_status = "pending"
    chain.sync_error = None

    db.add(chain)
    await db.commit()
    task = await create_sync_task(db, "chain_upsert", {"chain_id": str(chain.id)})
    await db.commit()
    try:
        get_queue().enqueue("app.workers.tasks.process_sync_task", str(task.id))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Enqueue failed: {exc}") from exc
    return ChainRead.model_validate(chain)


@router.delete("/admin/chains/{chain_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_chain(
    chain_id: UUID,
    db: AsyncSession = Depends(get_db),
    _ctx: CurrentUser = Depends(require_role("admin")),
) -> None:
    chain = await db.get(Chain, chain_id)
    if chain is None:
        raise HTTPException(status_code=404, detail="Chain not found")

    code = chain.code
    await db.execute(delete(UserChainAccess).where(UserChainAccess.chain_id == chain_id))
    await db.delete(chain)
    await db.commit()
    task = await create_sync_task(db, "chain_delete", {"code": code})
    await db.commit()
    try:
        get_queue().enqueue("app.workers.tasks.process_sync_task", str(task.id))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Enqueue failed: {exc}") from exc


@router.get("/admin/chains/{chain_id}/access", response_model=list[UserChainAccessRead])
async def admin_list_access(
    chain_id: UUID,
    db: AsyncSession = Depends(get_db),
    _ctx: CurrentUser = Depends(require_role("admin")),
) -> list[UserChainAccessRead]:
    result = await db.execute(
        select(UserChainAccess).where(UserChainAccess.chain_id == chain_id)
    )
    return [UserChainAccessRead.model_validate(a) for a in result.scalars().all()]


@router.post("/admin/chains/{chain_id}/sync", status_code=status.HTTP_202_ACCEPTED)
async def admin_resync_chain(
    chain_id: UUID,
    db: AsyncSession = Depends(get_db),
    _ctx: CurrentUser = Depends(require_role("admin")),
) -> dict:
    chain = await db.get(Chain, chain_id)
    if chain is None:
        raise HTTPException(status_code=404, detail="Chain not found")

    chain.sync_status = "pending"
    chain.sync_error = None
    chain.last_sync_attempt_at = None
    await db.commit()

    task = await create_sync_task(db, "chain_upsert", {"chain_id": str(chain.id)})
    await db.commit()
    try:
        get_queue().enqueue("app.workers.tasks.process_sync_task", str(task.id))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Enqueue failed: {exc}") from exc

    return {"status": "queued", "task_id": str(task.id)}

@router.post("/admin/access", response_model=UserChainAccessRead)
async def admin_grant_access(
    payload: UserChainAccessCreate,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUser = Depends(require_role("admin")),
) -> UserChainAccessRead:
    access = UserChainAccess(
        user_id=payload.user_id,
        chain_id=payload.chain_id,
        status=payload.status,
        quota_total=payload.quota_total,
        expires_at=payload.expires_at,
        granted_by=ctx.user.id,
        is_active=True,
    )
    db.add(access)
    await db.commit()
    return UserChainAccessRead.model_validate(access)


@router.post("/admin/access/by-email", response_model=UserChainAccessRead)
async def admin_grant_access_by_email(
    payload: UserChainAccessCreateByEmail,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUser = Depends(require_role("admin")),
) -> UserChainAccessRead:
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    access = UserChainAccess(
        user_id=user.id,
        chain_id=payload.chain_id,
        status=payload.status,
        quota_total=payload.quota_total,
        expires_at=payload.expires_at,
        granted_by=ctx.user.id,
        is_active=True,
    )
    db.add(access)
    await db.commit()
    return UserChainAccessRead.model_validate(access)


@router.put("/admin/access/{access_id}", response_model=UserChainAccessRead)
async def admin_update_access(
    access_id: UUID,
    payload: UserChainAccessUpdate,
    db: AsyncSession = Depends(get_db),
    _ctx: CurrentUser = Depends(require_role("admin")),
) -> UserChainAccessRead:
    access = await db.get(UserChainAccess, access_id)
    if access is None:
        raise HTTPException(status_code=404, detail="Access not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(access, field, value)

    db.add(access)
    await db.commit()
    return UserChainAccessRead.model_validate(access)


@router.get("/chains", response_model=UserChainListResponse)
async def user_list_chains(
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUser = Depends(get_current_context),
) -> UserChainListResponse:
    result = await db.execute(
        select(Chain, UserChainAccess)
        .join(UserChainAccess, UserChainAccess.chain_id == Chain.id)
        .where(UserChainAccess.user_id == ctx.user.id)
        .where(UserChainAccess.is_active.is_(True))
        .where(Chain.status == "active")
        .where(Chain.sync_status == "synced")
    )
    rows = result.all()
    items = [
        UserChainRead(
            id=chain.id,
            code=chain.code,
            name=chain.name,
            status=chain.status,
            visibility=chain.visibility,
            rpc_target_url=chain.rpc_target_url,
            description=chain.description,
            quota_total=access.quota_total,
            quota_used=access.quota_used,
            access_status=access.status,
        )
        for chain, access in rows
    ]
    return UserChainListResponse(items=items, total=len(items))


@router.get("/chains/available", response_model=PublicChainListResponse)
async def user_available_chains(
    db: AsyncSession = Depends(get_db),
    _ctx: CurrentUser = Depends(get_current_context),
) -> PublicChainListResponse:
    result = await db.execute(
        select(Chain)
        .where(Chain.status == "active")
        .where(Chain.visibility == "public")
    )
    items = result.scalars().all()
    return PublicChainListResponse(
        items=[PublicChainRead.model_validate(c) for c in items],
        total=len(items),
    )
