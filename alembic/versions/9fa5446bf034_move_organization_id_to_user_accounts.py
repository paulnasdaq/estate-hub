"""move organization_id to user_accounts

Revision ID: 9fa5446bf034
Revises: beb1a470a5eb
Create Date: 2026-07-05 14:42:44.767105

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9fa5446bf034"
down_revision: str | Sequence[str] | None = "beb1a470a5eb"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Batch mode rebuilds each table, so dropping users.organization_id also
    # removes its (unnamed) foreign key automatically.
    with op.batch_alter_table("user_accounts", schema=None) as batch_op:
        batch_op.add_column(sa.Column("organization_id", sa.Uuid(), nullable=True))
        batch_op.create_index(
            batch_op.f("ix_user_accounts_organization_id"),
            ["organization_id"],
            unique=False,
        )
        batch_op.create_foreign_key(
            "fk_user_accounts_organization_id_organizations",
            "organizations",
            ["organization_id"],
            ["id"],
        )

    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_users_organization_id"))
        batch_op.drop_column("organization_id")


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("organization_id", sa.Uuid(), nullable=True))
        batch_op.create_index(
            batch_op.f("ix_users_organization_id"), ["organization_id"], unique=False
        )
        batch_op.create_foreign_key(
            "fk_users_organization_id_organizations",
            "organizations",
            ["organization_id"],
            ["id"],
        )

    with op.batch_alter_table("user_accounts", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_user_accounts_organization_id"))
        batch_op.drop_column("organization_id")
