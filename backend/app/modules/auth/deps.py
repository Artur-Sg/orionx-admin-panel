import uuid
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.auth.security import decode_token
from app.modules.users.models import Membership, User


@dataclass(slots=True)
class CurrentUser:
    user: User
    org_id: str
    role: str

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = decode_token(credentials.credentials)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if payload.type != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user_id = uuid.UUID(payload.sub)
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")

    membership = await db.scalar(select(Membership).where(Membership.user_id == user.id))
    if membership is None or str(membership.organization_id) != payload.org_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid org")

    return user


async def get_current_context(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = decode_token(credentials.credentials)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if payload.type != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user_id = uuid.UUID(payload.sub)
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")

    membership = await db.scalar(select(Membership).where(Membership.user_id == user.id))
    if membership is None or str(membership.organization_id) != payload.org_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid org")

    return CurrentUser(user=user, org_id=str(membership.organization_id), role=membership.role)


def require_role(*roles: str):
    async def _checker(ctx: CurrentUser = Depends(get_current_context)) -> CurrentUser:
        if ctx.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return ctx

    return _checker
