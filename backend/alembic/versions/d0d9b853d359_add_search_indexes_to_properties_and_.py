"""add search indexes to properties and units

Revision ID: d0d9b853d359
Revises: 456bbcac1c4d
Create Date: 2026-07-07 14:01:30.401069

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d0d9b853d359"
down_revision: str | Sequence[str] | None = "456bbcac1c4d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Trigram GIN indexes make `name ILIKE '%term%'` (the search filter) index-backed
# instead of a full scan. They rely on the pg_trgm extension and GIN, both
# Postgres-only, so they are guarded by dialect and skipped on SQLite.
_TRGM_INDEXES = (
    ("ix_properties_name_trgm", "properties"),
    ("ix_units_name_trgm", "units"),
)


def upgrade() -> None:
    """Upgrade schema."""
    # Composite btree over the coordinates backs the bounding-box radius filter
    # (lat BETWEEN ... AND lng BETWEEN ...). Works on every dialect.
    op.create_index("ix_properties_lat_lng", "properties", ["lat", "lng"])

    if op.get_bind().dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        for index_name, table in _TRGM_INDEXES:
            op.create_index(
                index_name,
                table,
                ["name"],
                postgresql_using="gin",
                postgresql_ops={"name": "gin_trgm_ops"},
            )


def downgrade() -> None:
    """Downgrade schema."""
    if op.get_bind().dialect.name == "postgresql":
        for index_name, table in _TRGM_INDEXES:
            op.drop_index(index_name, table_name=table)

    op.drop_index("ix_properties_lat_lng", table_name="properties")
