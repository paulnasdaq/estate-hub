import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.auth import models, schemas
from app.auth.exceptions import EmailAlreadyExistsError, UserNotFoundError
from app.organizations.exceptions import OrganizationNotFoundError
from app.organizations.models import Organization


class UserService:
    """Data access and business logic for users."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, user_id: uuid.UUID) -> models.User:
        """Fetch a non-deleted user or raise UserNotFoundError."""
        user = self.db.get(models.User, user_id)
        if user is None or user.deleted_at is not None:
            raise UserNotFoundError(user_id)
        return user

    def list(
        self, limit: int, offset: int, search: str | None = None
    ) -> tuple[list[models.User], int]:
        """Return a page of active users and the matching total count.

        ``search`` filters on a case-insensitive substring of the first name,
        last name, or email.
        """
        filters = [models.User.deleted_at.is_(None)]
        if search:
            term = f"%{search}%"
            filters.append(
                or_(
                    models.User.first_name.ilike(term),
                    models.User.last_name.ilike(term),
                    models.User.email.ilike(term),
                )
            )
        total = self.db.scalar(
            select(func.count()).select_from(models.User).where(*filters)
        )
        items = list(
            self.db.scalars(
                select(models.User)
                .where(*filters)
                .order_by(models.User.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        return items, total or 0

    def create(self, payload: schemas.UserCreate) -> models.User:
        """Create a user together with an account in the given organization."""
        self._require_active_organization(payload.organization_id)
        self._require_unique_email(payload.email)

        user = models.User(
            first_name=payload.first_name,
            last_name=payload.last_name,
            email=payload.email,
            phone=payload.phone,
        )
        # Every user gets an account; here it is scoped to the organization.
        user.accounts.append(
            models.UserAccount(organization_id=payload.organization_id)
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def _require_active_organization(self, organization_id: uuid.UUID) -> None:
        org = self.db.get(Organization, organization_id)
        if org is None or org.deleted_at is not None:
            raise OrganizationNotFoundError(organization_id)

    def _require_unique_email(self, email: str) -> None:
        existing = self.db.scalar(
            select(models.User.id).where(models.User.email == email)
        )
        if existing is not None:
            raise EmailAlreadyExistsError(email)
