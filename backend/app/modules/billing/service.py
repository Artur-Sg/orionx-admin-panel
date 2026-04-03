from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.billing.models import Plan

DEFAULT_PLAN_CODE = "free"


async def get_or_create_default_plan(db: AsyncSession) -> Plan:
    result = await db.execute(select(Plan).where(Plan.code == DEFAULT_PLAN_CODE))
    plan = result.scalar_one_or_none()
    if plan is not None:
        return plan

    plan = Plan(code=DEFAULT_PLAN_CODE, name="Free", price_cents=0)
    db.add(plan)
    await db.flush()
    return plan
