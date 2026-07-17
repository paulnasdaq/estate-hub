from fastapi import APIRouter

from app.auth.routes import user_router
from app.billing.routes import bill_router, lease_bill_router
from app.leases.routes import lease_router
from app.organizations.routes import router as organizations_router
from app.payments.routes import (
    bill_payment_request_router,
    mpesa_router,
    payment_router,
)
from app.properties.routes import property_router, unit_router
from app.shared.routes import media_router

# Aggregate every feature router under a single versioned prefix.
api_router = APIRouter(prefix="/api/v1")
api_router.include_router(organizations_router)
api_router.include_router(user_router)
api_router.include_router(property_router)
api_router.include_router(unit_router)
api_router.include_router(lease_router)
api_router.include_router(lease_bill_router)
api_router.include_router(bill_router)
api_router.include_router(payment_router)
api_router.include_router(bill_payment_request_router)
api_router.include_router(mpesa_router)
api_router.include_router(media_router)
