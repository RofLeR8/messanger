"""merge_conflicting_heads

Revision ID: 17de3ff682da
Revises: 242cdfc4c3a2, e8c1a7a12f01
Create Date: 2026-04-18 15:47:29.662656

"""
from typing import Sequence, Union



# revision identifiers, used by Alembic.
revision: str = '17de3ff682da'
down_revision: Union[str, Sequence[str], None] = ('242cdfc4c3a2', 'e8c1a7a12f01')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
