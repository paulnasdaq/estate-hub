import uuid
from datetime import datetime

from pydantic import BaseModel

from app.core.schemas import TimestampedRead


class LeaseCreate(BaseModel):
    unit_id: uuid.UUID
    account_id: uuid.UUID
    effective_from: datetime
    terminated_on: datetime | None = None


class LeaseRead(TimestampedRead):
    unit_id: uuid.UUID
    account_id: uuid.UUID
    effective_from: datetime
    terminated_on: datetime | None = None
