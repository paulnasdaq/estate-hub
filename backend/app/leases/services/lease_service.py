import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.exceptions import UserAccountNotFoundError
from app.auth.models import UserAccount
from app.core.database import utcnow
from app.leases import models, schemas
from app.leases.exceptions import LeaseNotFoundError, UnitAlreadyLeasedError
from app.properties.exceptions import UnitNotFoundError
from app.properties.models import Unit


class LeaseService:
    """Data access and business logic for leases."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, lease_id: uuid.UUID) -> models.Lease:
        """Fetch a non-deleted lease or raise LeaseNotFoundError."""
        lease = self.db.get(models.Lease, lease_id)
        if lease is None or lease.deleted_at is not None:
            raise LeaseNotFoundError(lease_id)
        return lease

    def list(self, limit: int, offset: int) -> tuple[list[models.Lease], int]:
        """Return a page of active leases and the total active count."""
        active = models.Lease.deleted_at.is_(None)
        total = self.db.scalar(
            select(func.count()).select_from(models.Lease).where(active)
        )
        items = list(
            self.db.scalars(
                select(models.Lease)
                .where(active)
                .order_by(models.Lease.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        return items, total or 0

    def create(self, payload: schemas.LeaseCreate) -> models.Lease:
        self._require_active_unit(payload.unit_id)
        self._require_active_account(payload.account_id)
        # Only an active (non-terminated) lease claims the unit.
        if payload.terminated_on is None:
            self._require_unit_available(payload.unit_id)

        # Terms are handled via the relationship; the rest map straight onto the
        # Lease columns.
        lease = models.Lease(
            **payload.model_dump(exclude={"terms"}),
            terms=[models.LeaseTerm(**term.model_dump()) for term in payload.terms],
        )
        self.db.add(lease)
        self.db.commit()
        self.db.refresh(lease)
        return lease

    def update(self, lease: models.Lease, payload: schemas.LeaseUpdate) -> models.Lease:
        data = payload.model_dump(exclude_unset=True)
        # Effective values after the update, for re-validation.
        unit_id = data.get("unit_id", lease.unit_id)
        terminated_on = data.get("terminated_on", lease.terminated_on)

        if "unit_id" in data:
            self._require_active_unit(unit_id)
        if "account_id" in data:
            self._require_active_account(data["account_id"])
        # If the lease will be active, its unit must have no other active lease.
        if terminated_on is None:
            self._require_unit_available(unit_id, exclude_lease_id=lease.id)

        for field, value in data.items():
            setattr(lease, field, value)
        self.db.commit()
        self.db.refresh(lease)
        return lease

    def delete(self, lease: models.Lease) -> None:
        """Soft-delete a lease by setting deleted_at."""
        lease.deleted_at = utcnow()
        self.db.commit()

    def _require_active_unit(self, unit_id: uuid.UUID) -> None:
        unit = self.db.get(Unit, unit_id)
        if unit is None or unit.deleted_at is not None:
            raise UnitNotFoundError(unit_id)

    def _require_active_account(self, account_id: uuid.UUID) -> None:
        account = self.db.get(UserAccount, account_id)
        if account is None or account.deleted_at is not None:
            raise UserAccountNotFoundError(account_id)

    def _require_unit_available(
        self, unit_id: uuid.UUID, exclude_lease_id: uuid.UUID | None = None
    ) -> None:
        """Raise if the unit already has another active (non-terminated) lease."""
        stmt = select(models.Lease.id).where(
            models.Lease.unit_id == unit_id,
            models.Lease.terminated_on.is_(None),
            models.Lease.deleted_at.is_(None),
        )
        if exclude_lease_id is not None:
            stmt = stmt.where(models.Lease.id != exclude_lease_id)
        if self.db.scalar(stmt.limit(1)) is not None:
            raise UnitAlreadyLeasedError(unit_id)
