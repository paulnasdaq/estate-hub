from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.auth.routes import auth_router, user_router
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

# Every product router requires an authenticated user. Two routers are exempt:
# ``auth_router`` (login/activate are how you get a token; /me guards itself) and
# ``mpesa_router`` (Daraja's callback authenticates via a signed URL, not a user
# token — see payments/routes.py:verify_mpesa_callback).
authenticated = [Depends(get_current_user)]

# Aggregate every feature router under a single versioned prefix.
api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(mpesa_router)
api_router.include_router(organizations_router, dependencies=authenticated)
api_router.include_router(user_router, dependencies=authenticated)
api_router.include_router(property_router, dependencies=authenticated)
api_router.include_router(unit_router, dependencies=authenticated)
api_router.include_router(lease_router, dependencies=authenticated)
api_router.include_router(lease_bill_router, dependencies=authenticated)
api_router.include_router(bill_router, dependencies=authenticated)
api_router.include_router(payment_router, dependencies=authenticated)
api_router.include_router(bill_payment_request_router, dependencies=authenticated)
api_router.include_router(media_router, dependencies=authenticated)
