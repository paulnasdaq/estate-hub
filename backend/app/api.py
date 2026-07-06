from fastapi import APIRouter

from app.leases.routes import lease_router
from app.organizations.routes import router as organizations_router
from app.properties.routes import property_router, unit_router

# Aggregate every feature router under a single versioned prefix.
api_router = APIRouter(prefix="/api/v1")
api_router.include_router(organizations_router)
api_router.include_router(property_router)
api_router.include_router(unit_router)
api_router.include_router(lease_router)
