"""add category to properties

Revision ID: b8c3d4e5f6a7
Revises: a7b1c2d3e4f5
Create Date: 2026-07-19 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b8c3d4e5f6a7'
down_revision: str | Sequence[str] | None = 'a7b1c2d3e4f5'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('properties', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'category',
                sa.Enum(
                    'commercial',
                    'residential',
                    name='propertycategory',
                    native_enum=False,
                ),
                nullable=True,
            )
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('properties', schema=None) as batch_op:
        batch_op.drop_column('category')
