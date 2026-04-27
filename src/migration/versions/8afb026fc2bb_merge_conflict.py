"""merge conflict

Revision ID: 8afb026fc2bb
Revises: 0d0b0e81f548, add_updated_at_to_user_devices
Create Date: 2026-04-27 23:56:54.578268

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8afb026fc2bb'
down_revision: Union[str, Sequence[str], None] = ('0d0b0e81f548', 'add_updated_at_to_user_devices')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
