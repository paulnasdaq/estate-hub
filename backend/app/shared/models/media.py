import uuid

from sqlalchemy import Index, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Media(Base):
    """A stored media file (image, document, ...) attached to any entity.

    Media is polymorphic: rather than a foreign key to a single table, each row
    references its owner by ``entity_type`` (e.g. ``"property"``, ``"unit"``)
    plus ``entity_id``. The composite index backs "list media for an entity"
    lookups.
    """

    __tablename__ = "media"

    __table_args__ = (Index("ix_media_entity", "entity_type", "entity_id"),)

    # The kind of entity this media belongs to, e.g. "property" or "unit".
    entity_type: Mapped[str]
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    # Key/path of the object in the storage backend; unique per stored object.
    storage_key: Mapped[str] = mapped_column(unique=True)
    # MIME type, e.g. "image/jpeg".
    content_type: Mapped[str]
    size_bytes: Mapped[int]
    # Marks the representative media for the entity (e.g. cover image).
    is_primary: Mapped[bool] = mapped_column(default=False)
    # Ascending sort position within the entity's media.
    display_order: Mapped[int] = mapped_column(default=0)
