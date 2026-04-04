import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.security import hash_password, verify_password
from app.modules.billing.models import Subscription
from app.modules.billing.service import get_or_create_default_plan
from app.modules.users.models import Membership, Organization, User


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()



async def create_user_with_org(db: AsyncSession, email: str, password: str) -> tuple[User, Organization]:
    org_name = f"{email.split('@')[0]}'s org"
    user = User(email=email, hashed_password=hash_password(password))
    organization = Organization(name=org_name)
    membership = Membership(user=user, organization=organization, role="user")

    db.add_all([user, organization, membership])
    await db.flush()

    plan = await get_or_create_default_plan(db)
    subscription = Subscription(organization_id=organization.id, plan_id=plan.id, status="active")
    db.add(subscription)
    return user, organization


async def verify_user_credentials(db: AsyncSession, email: str, password: str) -> User | None:
    user = await get_user_by_email(db, email)
    if user is None:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


async def get_primary_org_id(db: AsyncSession, user: User) -> str | None:
    result = await db.execute(select(Membership).where(Membership.user_id == user.id))
    membership = result.scalar_one_or_none()
    if membership is None:
        return None
    return str(membership.organization_id)


async def get_primary_org_and_role(db: AsyncSession, user: User) -> tuple[str | None, str | None]:
    result = await db.execute(select(Membership).where(Membership.user_id == user.id))
    membership = result.scalar_one_or_none()
    if membership is None:
        return None, None
    return str(membership.organization_id), membership.role


async def ensure_user_org(db: AsyncSession, user: User) -> Organization:
    result = await db.execute(select(Membership).where(Membership.user_id == user.id))
    membership = result.scalar_one_or_none()
    if membership is not None:
        organization = await db.get(Organization, membership.organization_id)
        if organization is not None:
            return organization

    org_name = f"{user.email.split('@')[0]}'s org"
    organization = Organization(name=org_name)
    membership = Membership(user=user, organization=organization, role="user")

    db.add_all([organization, membership])
    await db.flush()

    plan = await get_or_create_default_plan(db)
    subscription = Subscription(organization_id=organization.id, plan_id=plan.id, status="active")
    db.add(subscription)
    return organization


async def get_or_create_user_from_google(db: AsyncSession, email: str) -> tuple[User, Organization, str]:
    user = await get_user_by_email(db, email)
    if user is None:
        random_secret = secrets.token_hex(16)
        user = User(email=email, hashed_password=hash_password(random_secret))
        organization = Organization(name=f"{email.split('@')[0]}'s org")
        membership = Membership(user=user, organization=organization, role="user")
        db.add_all([user, organization, membership])
        await db.flush()

        plan = await get_or_create_default_plan(db)
        subscription = Subscription(organization_id=organization.id, plan_id=plan.id, status="active")
        db.add(subscription)
        return user, organization, "user"

    organization = await ensure_user_org(db, user)
    org_id, role = await get_primary_org_and_role(db, user)
    return user, organization, role or "user"
