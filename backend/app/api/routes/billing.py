from fastapi import APIRouter

from app.modules.billing.schemas import ChangePlanRequest

router = APIRouter()


@router.get("/plans")
async def list_plans() -> list[dict]:
    return []


@router.post("/change-plan")
async def change_plan(payload: ChangePlanRequest) -> dict:
    # Placeholder: update subscription + enqueue APISIX sync task
    return {"status": "queued", "plan_code": payload.plan_code}
