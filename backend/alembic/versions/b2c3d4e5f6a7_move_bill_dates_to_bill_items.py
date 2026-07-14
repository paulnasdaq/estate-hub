"""move bill dates to bill items

Collapse the bill's start_date/end_date span into a single ``date`` and give
each bill item its own start_date/end_date service period.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-14 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: str | Sequence[str] | None = 'a1b2c3d4e5f6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # bill_items: add the service-period columns (nullable first so existing
    # rows can be backfilled from their parent bill's old span).
    with op.batch_alter_table("bill_items", schema=None) as batch_op:
        batch_op.add_column(sa.Column("start_date", sa.Date(), nullable=True))
        batch_op.add_column(sa.Column("end_date", sa.Date(), nullable=True))
    op.execute(
        """
        UPDATE bill_items
        SET start_date = (
                SELECT start_date FROM bills WHERE bills.id = bill_items.bill_id
            ),
            end_date = (
                SELECT end_date FROM bills WHERE bills.id = bill_items.bill_id
            )
        """
    )
    with op.batch_alter_table("bill_items", schema=None) as batch_op:
        batch_op.alter_column(
            "start_date", existing_type=sa.Date(), nullable=False
        )
        batch_op.alter_column(
            "end_date", existing_type=sa.Date(), nullable=False
        )

    # bills: collapse the span into a single date (keeping the old start_date),
    # then drop the span columns.
    with op.batch_alter_table("bills", schema=None) as batch_op:
        batch_op.add_column(sa.Column("date", sa.Date(), nullable=True))
    op.execute("UPDATE bills SET date = start_date")
    with op.batch_alter_table("bills", schema=None) as batch_op:
        batch_op.alter_column("date", existing_type=sa.Date(), nullable=False)
        batch_op.drop_column("start_date")
        batch_op.drop_column("end_date")


def downgrade() -> None:
    """Downgrade schema."""
    # bills: restore the span columns, backfilling both bounds from ``date``.
    with op.batch_alter_table("bills", schema=None) as batch_op:
        batch_op.add_column(sa.Column("start_date", sa.Date(), nullable=True))
        batch_op.add_column(sa.Column("end_date", sa.Date(), nullable=True))
    op.execute("UPDATE bills SET start_date = date, end_date = date")
    with op.batch_alter_table("bills", schema=None) as batch_op:
        batch_op.alter_column(
            "start_date", existing_type=sa.Date(), nullable=False
        )
        batch_op.alter_column(
            "end_date", existing_type=sa.Date(), nullable=False
        )
        batch_op.drop_column("date")

    with op.batch_alter_table("bill_items", schema=None) as batch_op:
        batch_op.drop_column("end_date")
        batch_op.drop_column("start_date")
