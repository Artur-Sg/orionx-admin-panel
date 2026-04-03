from fastapi import APIRouter, Depends

from app.modules.auth.deps import get_current_user
from app.modules.users.models import User
from app.modules.users.schemas import UserRead

router = APIRouter()


@router.get("/me", response_model=UserRead)
async def me(user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(user)
