"""add logo_url to organizations

Revision ID: a7b1c2d3e4f5
Revises: fc6a2786d1d6
Create Date: 2026-07-18 14:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a7b1c2d3e4f5'
down_revision: str | Sequence[str] | None = 'fc6a2786d1d6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('organizations', schema=None) as batch_op:
        batch_op.add_column(sa.Column('logo_url', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('organizations', schema=None) as batch_op:
        batch_op.drop_column('logo_url')
