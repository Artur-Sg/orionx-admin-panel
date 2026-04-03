import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.modules.auth.schemas import GoogleAuthRequest, LoginRequest, RefreshRequest, TokenResponse
from app.modules.auth.security import create_token, decode_token
from app.modules.auth.service import (
    create_user_with_org,
    get_or_create_user_from_google,
    get_primary_org_id,
    get_user_by_email,
    verify_user_credentials,
)
from app.modules.users.schemas import UserCreate

router = APIRouter()


def _token_pair(user_id: str, org_id: str) -> TokenResponse:
    access_ttl = settings.jwt_access_ttl_min * 60
    refresh_ttl = settings.jwt_refresh_ttl_days * 24 * 60 * 60
    access_token = create_token(user_id, org_id, "access", access_ttl)
    refresh_token = create_token(user_id, org_id, "refresh", refresh_ttl)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/signup", response_model=TokenResponse)
async def signup(payload: UserCreate, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    existing = await get_user_by_email(db, payload.email)
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    async with db.begin():
        user, org = await create_user_with_org(db, payload.email, payload.password)

    return _token_pair(str(user.id), str(org.id))


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await verify_user_credentials(db, payload.email, payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    org_id = await get_primary_org_id(db, user)
    if org_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User has no organization")

    return _token_pair(str(user.id), org_id)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest) -> TokenResponse:
    try:
        token_payload = decode_token(payload.refresh_token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if token_payload.type != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    return _token_pair(token_payload.sub, token_payload.org_id)


@router.post("/google", response_model=TokenResponse)
async def google_auth(
    payload: GoogleAuthRequest, db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google client ID not configured",
        )

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": payload.credential},
        )

    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")

    data = response.json()
    if data.get("aud") != settings.google_client_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")

    if str(data.get("email_verified", "true")).lower() == "false":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email not verified")

    email = data.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email not provided")

    async with db.begin():
        user, org = await get_or_create_user_from_google(db, email)

    return _token_pair(str(user.id), str(org.id))
