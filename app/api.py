from fastapi import APIRouter

from app.organizations.routes import router as organizations_router

# Aggregate every feature router under a single versioned prefix.
api_router = APIRouter(prefix="/api/v1")
api_router.include_router(organizations_router)
