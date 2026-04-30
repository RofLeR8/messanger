"""empty message

Revision ID: e6b2145828ca
Revises: 0001a1b2c3d4, 17de3ff682da
Create Date: 2026-04-30 04:06:58.480625

"""
from typing import Sequence, Union



# revision identifiers, used by Alembic.
revision: str = 'e6b2145828ca'
down_revision: Union[str, Sequence[str], None] = ('0001a1b2c3d4', '17de3ff682da')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
