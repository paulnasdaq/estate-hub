"""add lease_term_id to bill_items

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-14 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: str | Sequence[str] | None = "b2c3d4e5f6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("bill_items", schema=None) as batch_op:
        batch_op.add_column(sa.Column("lease_term_id", sa.Uuid(), nullable=True))
        batch_op.create_index(
            batch_op.f("ix_bill_items_lease_term_id"),
            ["lease_term_id"],
            unique=False,
        )
        batch_op.create_foreign_key(
            "fk_bill_items_lease_term_id_lease_terms",
            "lease_terms",
            ["lease_term_id"],
            ["id"],
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("bill_items", schema=None) as batch_op:
        batch_op.drop_constraint(
            "fk_bill_items_lease_term_id_lease_terms", type_="foreignkey"
        )
        batch_op.drop_index(batch_op.f("ix_bill_items_lease_term_id"))
        batch_op.drop_column("lease_term_id")
