"""add response json to payment_requests

Revision ID: 190e561ac0f9
Revises: 95cb8c62e167
Create Date: 2026-07-16 21:45:11.938664

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '190e561ac0f9'
down_revision: str | Sequence[str] | None = '95cb8c62e167'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("payment_requests", schema=None) as batch_op:
        batch_op.add_column(sa.Column("response", sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("payment_requests", schema=None) as batch_op:
        batch_op.drop_column("response")
