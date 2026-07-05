import uuid

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db

from . import models
from .services import OrganizationService


def get_organization_or_404(
    org_id: uuid.UUID, db: Session = Depends(get_db)
) -> models.Organization:
    """Resolve the path's org_id to an active Organization or raise 404."""
    return OrganizationService(db).get(org_id)
