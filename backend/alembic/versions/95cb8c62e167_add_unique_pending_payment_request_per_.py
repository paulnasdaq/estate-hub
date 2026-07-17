"""add unique pending payment request per bill

Revision ID: 95cb8c62e167
Revises: 80ed755ede1d
Create Date: 2026-07-16 20:36:29.565696

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '95cb8c62e167'
down_revision: str | Sequence[str] | None = '80ed755ede1d'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("payment_requests", schema=None) as batch_op:
        batch_op.create_index(
            "uq_payment_requests_bill_pending",
            ["bill_id"],
            unique=True,
            postgresql_where=sa.text("status = 'pending' AND deleted_at IS NULL"),
            sqlite_where=sa.text("status = 'pending' AND deleted_at IS NULL"),
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("payment_requests", schema=None) as batch_op:
        batch_op.drop_index(
            "uq_payment_requests_bill_pending",
            postgresql_where=sa.text("status = 'pending' AND deleted_at IS NULL"),
            sqlite_where=sa.text("status = 'pending' AND deleted_at IS NULL"),
        )
