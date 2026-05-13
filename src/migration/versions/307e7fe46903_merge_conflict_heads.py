"""merge conflict heads

Revision ID: 307e7fe46903
Revises: b2c3d4e5f6a7, 26e91c10241c
Create Date: 2026-05-07 13:10:16.291379

"""
from typing import Sequence, Union



# revision identifiers, used by Alembic.
revision: str = '307e7fe46903'
down_revision: Union[str, Sequence[str], None] = ('b2c3d4e5f6a7', '26e91c10241c')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
