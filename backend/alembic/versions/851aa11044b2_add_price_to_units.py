"""add price to units

Revision ID: 851aa11044b2
Revises: d0d9b853d359
Create Date: 2026-07-07 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "851aa11044b2"
down_revision: str | Sequence[str] | None = "d0d9b853d359"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add the non-nullable column with a temporary server default so any existing
    # rows are backfilled with 0, then drop the default so the column matches the
    # model (which declares no server default).
    with op.batch_alter_table("units", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("price", sa.Integer(), nullable=False, server_default="0")
        )
    with op.batch_alter_table("units", schema=None) as batch_op:
        batch_op.alter_column("price", server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("units", schema=None) as batch_op:
        batch_op.drop_column("price")
