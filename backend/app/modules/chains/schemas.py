from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class ChainCreate(BaseModel):
    code: str
    name: str
    status: str = "draft"
    visibility: str = "private"
    rpc_target_url: str
    description: str | None = None
    sort_order: int = 0


class ChainUpdate(BaseModel):
    name: str | None = None
    status: str | None = None
    visibility: str | None = None
    rpc_target_url: str | None = None
    description: str | None = None
    sort_order: int | None = None


class ChainRead(BaseModel):
    id: UUID
    code: str
    name: str
    status: str
    visibility: str
    rpc_target_url: str
    description: str | None
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChainListResponse(BaseModel):
    items: list[ChainRead]
    total: int


class UserChainAccessRead(BaseModel):
    id: UUID
    user_id: UUID
    chain_id: UUID
    status: str
    quota_total: int | None
    quota_used: int
    is_active: bool
    expires_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserChainAccessCreate(BaseModel):
    user_id: UUID
    chain_id: UUID
    status: str = "active"
    quota_total: int | None = None
    expires_at: datetime | None = None


class UserChainAccessCreateByEmail(BaseModel):
    email: EmailStr
    chain_id: UUID
    status: str = "active"
    quota_total: int | None = None
    expires_at: datetime | None = None


class UserChainAccessUpdate(BaseModel):
    status: str | None = None
    quota_total: int | None = None
    quota_used: int | None = None
    is_active: bool | None = None
    expires_at: datetime | None = None


class UserChainRead(BaseModel):
    id: UUID
    code: str
    name: str
    status: str
    visibility: str
    rpc_target_url: str
    description: str | None
    quota_total: int | None
    quota_used: int
    access_status: str

    model_config = {"from_attributes": True}


class UserChainListResponse(BaseModel):
    items: list[UserChainRead]
    total: int
