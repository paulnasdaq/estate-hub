from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.pagination import PaginationParams
from app.core.schemas import Page

from . import models, schemas
from .dependencies import get_lease_or_404
from .services import LeaseService

lease_router = APIRouter(prefix="/leases", tags=["leases"])


@lease_router.get("", response_model=Page[schemas.LeaseRead])
def list_leases(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
) -> Page[schemas.LeaseRead]:
    items, total = LeaseService(db).list(pagination.limit, pagination.offset)
    return Page(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@lease_router.post(
    "", response_model=schemas.LeaseRead, status_code=status.HTTP_201_CREATED
)
def create_lease(payload: schemas.LeaseCreate, db: Session = Depends(get_db)):
    return LeaseService(db).create(payload)


@lease_router.get("/{lease_id}", response_model=schemas.LeaseRead)
def get_lease(
    lease: models.Lease = Depends(get_lease_or_404),
):
    return lease


@lease_router.patch("/{lease_id}", response_model=schemas.LeaseRead)
def update_lease(
    payload: schemas.LeaseUpdate,
    lease: models.Lease = Depends(get_lease_or_404),
    db: Session = Depends(get_db),
):
    return LeaseService(db).update(lease, payload)


@lease_router.delete("/{lease_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lease(
    lease: models.Lease = Depends(get_lease_or_404),
    db: Session = Depends(get_db),
) -> Response:
    LeaseService(db).delete(lease)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
