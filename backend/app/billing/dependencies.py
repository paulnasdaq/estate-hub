import uuid

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db

from . import models
from .services import BillService


def get_bill_or_404(bill_id: uuid.UUID, db: Session = Depends(get_db)) -> models.Bill:
    """Resolve the path's bill_id to an active Bill or raise 404."""
    return BillService(db).get(bill_id)
