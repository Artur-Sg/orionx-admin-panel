from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    id: UUID
    email: EmailStr
    is_active: bool

    model_config = {"from_attributes": True}


class UserMe(UserRead):
    org_id: UUID
    role: str


class AdminUserRead(UserRead):
    role: str


class AdminUserListResponse(BaseModel):
    items: list[AdminUserRead]
    total: int


class AdminUserUpdateRequest(BaseModel):
    email: EmailStr | None = None
    is_active: bool | None = None
    role: str | None = None
