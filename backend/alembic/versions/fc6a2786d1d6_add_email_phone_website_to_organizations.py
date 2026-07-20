"""add email phone website to organizations

Revision ID: fc6a2786d1d6
Revises: dc8dac39e77a
Create Date: 2026-07-18 13:12:38.336698

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'fc6a2786d1d6'
down_revision: str | Sequence[str] | None = 'dc8dac39e77a'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('organizations', schema=None) as batch_op:
        batch_op.add_column(sa.Column('email', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('phone', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('website', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('organizations', schema=None) as batch_op:
        batch_op.drop_column('website')
        batch_op.drop_column('phone')
        batch_op.drop_column('email')
