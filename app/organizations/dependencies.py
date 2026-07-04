import uuid

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db

from . import models, services


def get_organization_or_404(
    org_id: uuid.UUID, db: Session = Depends(get_db)
) -> models.Organization:
    """Resolve the path's org_id to an active Organization or raise 404."""
    return services.get_organization(db, org_id)
