"""empty message

Revision ID: 33587550a3d9
Revises: 8afb026fc2bb
Create Date: 2026-04-28 01:00:46.458660

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '33587550a3d9'
down_revision: Union[str, Sequence[str], None] = '8afb026fc2bb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
