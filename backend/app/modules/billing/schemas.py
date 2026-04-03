from uuid import UUID

from pydantic import BaseModel


class PlanRead(BaseModel):
    id: UUID
    code: str
    name: str
    price_cents: int

    model_config = {"from_attributes": True}


class ChangePlanRequest(BaseModel):
    plan_code: str
