from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.exceptions import UserAccountNotFoundError
from app.auth.models import UserAccount
from app.leases import models, schemas
from app.leases.exceptions import UnitAlreadyLeasedError
from app.properties.exceptions import UnitNotFoundError
from app.properties.models import Unit


class LeaseService:
    """Data access and business logic for leases."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, payload: schemas.LeaseCreate) -> models.Lease:
        # Referenced unit and account must exist and be active, else 404.
        unit = self.db.get(Unit, payload.unit_id)
        if unit is None or unit.deleted_at is not None:
            raise UnitNotFoundError(payload.unit_id)
        account = self.db.get(UserAccount, payload.account_id)
        if account is None or account.deleted_at is not None:
            raise UserAccountNotFoundError(payload.account_id)

        # A unit may hold only one active (non-terminated) lease at a time.
        active_lease = self.db.scalar(
            select(models.Lease.id)
            .where(
                models.Lease.unit_id == payload.unit_id,
                models.Lease.terminated_on.is_(None),
                models.Lease.deleted_at.is_(None),
            )
            .limit(1)
        )
        if active_lease is not None:
            raise UnitAlreadyLeasedError(payload.unit_id)

        lease = models.Lease(**payload.model_dump())
        self.db.add(lease)
        self.db.commit()
        self.db.refresh(lease)
        return lease
