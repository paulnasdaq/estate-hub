from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Organization(Base):
    """A tenant organization in the property-management SaaS."""

    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(index=True)
