"""merge conflict

Revision ID: 0d0b0e81f548
Revises: 17de3ff682da, add_user_devices
Create Date: 2026-04-27 23:29:02.307218

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0d0b0e81f548'
down_revision: Union[str, Sequence[str], None] = ('17de3ff682da', 'add_user_devices')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
