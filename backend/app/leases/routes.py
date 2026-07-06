from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db

from . import schemas
from .services import LeaseService

lease_router = APIRouter(prefix="/leases", tags=["leases"])


@lease_router.post(
    "", response_model=schemas.LeaseRead, status_code=status.HTTP_201_CREATED
)
def create_lease(payload: schemas.LeaseCreate, db: Session = Depends(get_db)):
    return LeaseService(db).create(payload)
