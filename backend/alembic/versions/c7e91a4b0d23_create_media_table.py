"""create media table

Revision ID: c7e91a4b0d23
Revises: 851aa11044b2
Create Date: 2026-07-08 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c7e91a4b0d23"
down_revision: str | Sequence[str] | None = "851aa11044b2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "media",
        sa.Column("entity_type", sa.String(), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("storage_key", sa.String(), nullable=False),
        sa.Column("content_type", sa.String(), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("media", schema=None) as batch_op:
        batch_op.create_index(
            "ix_media_entity", ["entity_type", "entity_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_media_storage_key"),
            ["storage_key"],
            unique=True,
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("media", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_media_storage_key"))
        batch_op.drop_index("ix_media_entity")

    op.drop_table("media")
