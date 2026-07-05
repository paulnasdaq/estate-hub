"""tie user_roles to user_accounts

Revision ID: beb1a470a5eb
Revises: 5f7d472d618f
Create Date: 2026-07-05 13:51:39.113523

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "beb1a470a5eb"
down_revision: str | Sequence[str] | None = "5f7d472d618f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Batch mode rebuilds the table, so dropping user_id also removes its
    # (unnamed) foreign key and the old unique constraint automatically.
    with op.batch_alter_table("user_roles", schema=None) as batch_op:
        batch_op.add_column(sa.Column("user_account_id", sa.Uuid(), nullable=False))
        batch_op.drop_index(batch_op.f("ix_user_roles_user_id"))
        batch_op.create_index(
            batch_op.f("ix_user_roles_user_account_id"),
            ["user_account_id"],
            unique=False,
        )
        batch_op.create_unique_constraint(
            "uq_user_roles_user_account_id_role_id", ["user_account_id", "role_id"]
        )
        batch_op.create_foreign_key(
            "fk_user_roles_user_account_id_user_accounts",
            "user_accounts",
            ["user_account_id"],
            ["id"],
        )
        batch_op.drop_column("user_id")


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("user_roles", schema=None) as batch_op:
        batch_op.add_column(sa.Column("user_id", sa.Uuid(), nullable=False))
        batch_op.drop_index(batch_op.f("ix_user_roles_user_account_id"))
        batch_op.create_index(
            batch_op.f("ix_user_roles_user_id"), ["user_id"], unique=False
        )
        batch_op.create_unique_constraint(
            "uq_user_roles_user_id_role_id", ["user_id", "role_id"]
        )
        batch_op.create_foreign_key(
            "fk_user_roles_user_id_users", "users", ["user_id"], ["id"]
        )
        batch_op.drop_column("user_account_id")
