from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.pagination import PaginationParams
from app.core.schemas import Page
from app.leases.dependencies import get_lease_or_404
from app.leases.models import Lease

from . import models, schemas, tasks
from .dependencies import get_bill_or_404
from .services import BillService

bill_router = APIRouter(prefix="/bills", tags=["bills"])

# Lease-scoped bill routes. Lives here (not in the leases module) because it
# depends on BillService; billing already depends on leases, so this avoids a
# circular import.
lease_bill_router = APIRouter(prefix="/leases", tags=["bills"])


@lease_bill_router.get("/{lease_id}/bills", response_model=Page[schemas.BillRead])
def list_lease_bills(
    lease: Lease = Depends(get_lease_or_404),
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
) -> Page[schemas.BillRead]:
    items, total = BillService(db).list_for_lease(
        lease.id, pagination.limit, pagination.offset
    )
    return Page(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@bill_router.get("", response_model=Page[schemas.BillRead])
def list_bills(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
) -> Page[schemas.BillRead]:
    items, total = BillService(db).list(pagination.limit, pagination.offset)
    return Page(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@bill_router.post(
    "", response_model=schemas.BillRead, status_code=status.HTTP_201_CREATED
)
def create_bill(payload: schemas.BillCreate, db: Session = Depends(get_db)):
    bill = BillService(db).create(payload)
    # The bill is committed; render its receipt and email the tenant off-request.
    tasks.enqueue_bill_receipt_and_notification(bill.id)
    return bill


@bill_router.get("/{bill_id}", response_model=schemas.BillRead)
def get_bill(
    bill: models.Bill = Depends(get_bill_or_404),
):
    return bill


@bill_router.patch("/{bill_id}", response_model=schemas.BillRead)
def update_bill(
    payload: schemas.BillUpdate,
    bill: models.Bill = Depends(get_bill_or_404),
    db: Session = Depends(get_db),
):
    return BillService(db).update(bill, payload)


@bill_router.delete("/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bill(
    bill: models.Bill = Depends(get_bill_or_404),
    db: Session = Depends(get_db),
) -> Response:
    BillService(db).delete(bill)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
