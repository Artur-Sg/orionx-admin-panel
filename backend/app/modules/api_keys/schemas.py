from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ApiKeyCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    user_id: UUID
    chain_id: UUID
    quota_total: int | None = None


class ApiKeyCreateResponse(BaseModel):
    id: UUID
    name: str
    key: str
    key_prefix: str
    key_last4: str
    status: str
    user_id: UUID
    chain_id: UUID
    quota_total: int | None
    quota_used: int
    created_at: datetime


class ApiKeyRead(BaseModel):
    id: UUID
    user_id: UUID
    chain_id: UUID
    name: str
    key_prefix: str
    key_last4: str
    status: str
    quota_total: int | None
    quota_used: int
    created_at: datetime
    revoked_at: datetime | None

    model_config = {"from_attributes": True}


class ApiKeyUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    quota_total: int | None = None
    quota_used: int | None = None
    status: str | None = None


class ApiKeyRevealResponse(BaseModel):
    id: UUID
    key: str
