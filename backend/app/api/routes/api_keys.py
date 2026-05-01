from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.api_keys.models import ApiKey
from app.modules.api_keys.schemas import (
    ApiKeyCreateRequest,
    ApiKeyCreateResponse,
    ApiKeyRead,
    ApiKeyRevealResponse,
    ApiKeyUpdateRequest,
)
from app.modules.api_keys.crypto import decrypt_api_key, encrypt_api_key
from app.modules.api_keys.service import (
    generate_plain_api_key,
    get_api_key,
    hash_api_key,
    list_active_user_api_keys_for_chain,
    list_all_api_keys,
    list_user_api_keys,
    mark_key_revoked,
    resolve_quota_window_seconds,
)
from app.modules.auth.deps import CurrentUser, get_current_context, require_role
from app.modules.chains.models import Chain, UserChainAccess
from app.modules.sync.service import create_sync_task
from app.modules.users.models import User
from app.workers.queue import get_queue

router = APIRouter()


async def _serialize_api_keys(db: AsyncSession, items: list[ApiKey]) -> list[ApiKeyRead]:
    chain_ids = {item.chain_id for item in items}
    chain_names: dict = {}
    if chain_ids:
        chain_rows = await db.execute(select(Chain.id, Chain.name).where(Chain.id.in_(chain_ids)))
        chain_names = {row[0]: row[1] for row in chain_rows.all()}

    result: list[ApiKeyRead] = []
    for item in items:
        data = ApiKeyRead.model_validate(item).model_dump()
        data["chain_name"] = chain_names.get(item.chain_id)
        result.append(ApiKeyRead(**data))
    return result


@router.get("/api-keys/me", response_model=list[ApiKeyRead])
async def get_my_api_keys(
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUser = Depends(get_current_context),
) -> list[ApiKeyRead]:
    items = await list_user_api_keys(db, str(ctx.user.id))
    return await _serialize_api_keys(db, items)


@router.get("/admin/api-keys", response_model=list[ApiKeyRead])
async def list_admin_api_keys(
    db: AsyncSession = Depends(get_db),
    _ctx: CurrentUser = Depends(require_role("admin")),
) -> list[ApiKeyRead]:
    items = await list_all_api_keys(db)
    return await _serialize_api_keys(db, items)


@router.post("/admin/api-keys", response_model=ApiKeyCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key_for_user(
    payload: ApiKeyCreateRequest,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUser = Depends(require_role("admin")),
) -> ApiKeyCreateResponse:
    user = await db.get(User, payload.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    chain = await db.get(Chain, payload.chain_id)
    if chain is None:
        raise HTTPException(status_code=404, detail="Chain not found")

    access_result = await db.execute(
        select(UserChainAccess).where(
            UserChainAccess.user_id == payload.user_id,
            UserChainAccess.chain_id == payload.chain_id,
        )
    )
    access = access_result.scalars().first()
    if access is None:
        access = UserChainAccess(
            user_id=payload.user_id,
            chain_id=payload.chain_id,
            status="active",
            quota_total=payload.quota_total,
            quota_used=0,
            is_active=True,
            granted_by=ctx.user.id,
        )
    else:
        access.is_active = True
        access.status = "active"
        if access.quota_total is None and payload.quota_total is not None:
            access.quota_total = payload.quota_total
    db.add(access)

    active_keys = await list_active_user_api_keys_for_chain(
        db, str(payload.user_id), str(payload.chain_id)
    )
    for key in active_keys:
        mark_key_revoked(key)
        db.add(key)

    try:
        effective_window = resolve_quota_window_seconds(
            payload.quota_total, payload.quota_mode, payload.quota_window_seconds
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    plain_key = generate_plain_api_key()
    key_hash = hash_api_key(plain_key)
    key_prefix = plain_key[:8]
    key_last4 = plain_key[-4:]

    item = ApiKey(
        user_id=payload.user_id,
        chain_id=payload.chain_id,
        name=payload.name.strip(),
        key_hash=key_hash,
        key_encrypted=encrypt_api_key(plain_key),
        key_prefix=key_prefix,
        key_last4=key_last4,
        status="active",
        quota_total=payload.quota_total,
        quota_mode=payload.quota_mode,
        quota_window_seconds=effective_window,
        quota_used=0,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    task = await create_sync_task(
        db,
        "api_key_upsert",
        {
            "user_id": str(payload.user_id),
            "api_key_id": str(item.id),
            "plain_key": plain_key,
            "status": "active",
            "quota_total": item.quota_total,
            "quota_window_seconds": item.quota_window_seconds,
        },
    )
    await db.commit()
    get_queue().enqueue("app.workers.tasks.process_sync_task", str(task.id))

    return ApiKeyCreateResponse(
        id=item.id,
        name=item.name,
        key=plain_key,
        key_prefix=item.key_prefix,
        key_last4=item.key_last4,
        status=item.status,
        user_id=item.user_id,
        chain_id=item.chain_id,
        quota_total=item.quota_total,
        quota_mode=item.quota_mode,
        quota_window_seconds=item.quota_window_seconds,
        quota_used=item.quota_used,
        created_at=item.created_at,
    )


@router.put("/admin/api-keys/{api_key_id}", response_model=ApiKeyRead)
async def update_api_key(
    api_key_id: str,
    payload: ApiKeyUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _ctx: CurrentUser = Depends(require_role("admin")),
) -> ApiKeyRead:
    item = await db.get(ApiKey, api_key_id)
    if item is None:
        raise HTTPException(status_code=404, detail="API key not found")

    if payload.name is not None:
        item.name = payload.name.strip()
    if payload.quota_total is not None:
        item.quota_total = payload.quota_total
    if payload.quota_mode is not None:
        item.quota_mode = payload.quota_mode
    if payload.quota_window_seconds is not None:
        item.quota_window_seconds = payload.quota_window_seconds
    if payload.quota_used is not None:
        item.quota_used = payload.quota_used
    if payload.status is not None and payload.status in {"active", "revoked"}:
        item.status = payload.status
        if payload.status == "revoked":
            mark_key_revoked(item)

    try:
        item.quota_window_seconds = resolve_quota_window_seconds(
            item.quota_total, item.quota_mode, item.quota_window_seconds
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    db.add(item)
    await db.commit()
    await db.refresh(item)

    if item.status == "active":
        plain_key = decrypt_api_key(item.key_encrypted) if item.key_encrypted else None
        if plain_key is not None:
            task = await create_sync_task(
                db,
                "api_key_upsert",
                {
                    "user_id": str(item.user_id),
                    "api_key_id": str(item.id),
                    "plain_key": plain_key,
                    "status": "active",
                    "quota_total": item.quota_total,
                    "quota_window_seconds": item.quota_window_seconds,
                },
            )
            await db.commit()
            get_queue().enqueue("app.workers.tasks.process_sync_task", str(task.id))
    elif item.status == "revoked":
        task = await create_sync_task(
            db,
            "api_key_upsert",
            {
                "user_id": str(item.user_id),
                "api_key_id": str(item.id),
                "plain_key": None,
                "status": "revoked",
            },
        )
        await db.commit()
        get_queue().enqueue("app.workers.tasks.process_sync_task", str(task.id))

    response = await _serialize_api_keys(db, [item])
    return response[0]


@router.get("/api-keys/me/{api_key_id}/reveal", response_model=ApiKeyRevealResponse)
async def reveal_my_api_key(
    api_key_id: str,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUser = Depends(get_current_context),
) -> ApiKeyRevealResponse:
    item = await get_api_key(db, api_key_id, str(ctx.user.id))
    if item is None:
        raise HTTPException(status_code=404, detail="API key not found")
    if not item.key_encrypted:
        raise HTTPException(status_code=409, detail="Key cannot be revealed, regenerate it")
    return ApiKeyRevealResponse(id=item.id, key=decrypt_api_key(item.key_encrypted))


@router.delete("/admin/api-keys/{api_key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    api_key_id: str,
    db: AsyncSession = Depends(get_db),
    _ctx: CurrentUser = Depends(require_role("admin")),
) -> None:
    item = await db.get(ApiKey, api_key_id)
    if item is None:
        raise HTTPException(status_code=404, detail="API key not found")

    task = await create_sync_task(
        db,
        "api_key_upsert",
        {
            "user_id": str(item.user_id),
            "api_key_id": str(item.id),
            "plain_key": None,
            "status": "revoked",
        },
    )
    await db.delete(item)
    await db.commit()
    get_queue().enqueue("app.workers.tasks.process_sync_task", str(task.id))


@router.post("/admin/api-keys/{api_key_id}/revoke", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    api_key_id: str,
    db: AsyncSession = Depends(get_db),
    _ctx: CurrentUser = Depends(require_role("admin")),
) -> None:
    item = await db.get(ApiKey, api_key_id)
    if item is None:
        raise HTTPException(status_code=404, detail="API key not found")

    mark_key_revoked(item)
    db.add(item)
    await db.commit()

    task = await create_sync_task(
        db,
        "api_key_upsert",
        {
            "user_id": str(item.user_id),
            "api_key_id": str(item.id),
            "plain_key": None,
            "status": "revoked",
        },
    )
    await db.commit()
    get_queue().enqueue("app.workers.tasks.process_sync_task", str(task.id))
