from fastapi import APIRouter, Depends
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.auth.deps import CurrentUser, get_current_context, require_role
from app.modules.users.models import User
from app.modules.users.models import Membership
from app.modules.users.schemas import (
    AdminUserListResponse,
    AdminUserRead,
    AdminUserUpdateRequest,
    UserMe,
    UserRead,
)

router = APIRouter()


@router.get("/me", response_model=UserMe)
async def me(ctx: CurrentUser = Depends(get_current_context)) -> UserMe:
    return UserMe(
        id=ctx.user.id,
        email=ctx.user.email,
        is_active=ctx.user.is_active,
        org_id=ctx.org_id,
        role=ctx.role,
    )


@router.get("/admin/users", response_model=AdminUserListResponse)
async def list_users(
    db: AsyncSession = Depends(get_db),
    _ctx: CurrentUser = Depends(require_role("admin")),
    search: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[UserRead]:
    base_query = select(User, Membership.role).join(Membership, Membership.user_id == User.id)
    if search:
        base_query = base_query.where(User.email.ilike(f"%{search}%"))

    total_query = select(func.count()).select_from(base_query.subquery())
    total = (await db.execute(total_query)).scalar_one()

    result = await db.execute(base_query.limit(limit).offset(offset))
    items = [
        AdminUserRead(id=user.id, email=user.email, is_active=user.is_active, role=role)
        for user, role in result.all()
    ]
    return AdminUserListResponse(items=items, total=total)


@router.put("/admin/users/{user_id}", response_model=AdminUserRead)
async def update_user(
    user_id: UUID,
    payload: AdminUserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _ctx: CurrentUser = Depends(require_role("admin")),
) -> AdminUserRead:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    result = await db.execute(select(Membership).where(Membership.user_id == user.id))
    membership = result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(status_code=404, detail="Membership not found")

    if payload.email is not None:
        user.email = payload.email
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.role is not None:
        membership.role = payload.role

    db.add_all([user, membership])
    await db.commit()

    return AdminUserRead(
        id=user.id,
        email=user.email,
        is_active=user.is_active,
        role=membership.role,
    )
