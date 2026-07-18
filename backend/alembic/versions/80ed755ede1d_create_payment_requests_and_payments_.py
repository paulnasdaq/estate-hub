"""create payment requests and payments tables

Revision ID: 80ed755ede1d
Revises: 19b7d807824d
Create Date: 2026-07-16 13:32:56.473898

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "80ed755ede1d"
down_revision: str | Sequence[str] | None = "19b7d807824d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "payment_requests",
        sa.Column("bill_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "failed",
                "successful",
                name="paymentstatus",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["bill_id"],
            ["bills.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("payment_requests", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_payment_requests_bill_id"), ["bill_id"], unique=False
        )

    op.create_table(
        "payments",
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("payment_request_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["payment_request_id"],
            ["payment_requests.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("payments", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_payments_payment_request_id"),
            ["payment_request_id"],
            unique=False,
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("payments", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_payments_payment_request_id"))

    op.drop_table("payments")
    with op.batch_alter_table("payment_requests", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_payment_requests_bill_id"))

    op.drop_table("payment_requests")
