import uuid

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db

from . import models
from .services import LeaseService


def get_lease_or_404(
    lease_id: uuid.UUID, db: Session = Depends(get_db)
) -> models.Lease:
    """Resolve the path's lease_id to an active Lease or raise 404."""
    return LeaseService(db).get(lease_id)
