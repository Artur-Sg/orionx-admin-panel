from fastapi import APIRouter

from app.api.routes import api_keys, auth, billing, chains, health, users

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
api_router.include_router(chains.router, tags=["chains"])
api_router.include_router(api_keys.router, tags=["api_keys"])
