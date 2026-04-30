"""merge conflict

Revision ID: 26e91c10241c
Revises: 20260430_add_group_chat_photo, eeab2498aa50
Create Date: 2026-04-30 09:55:39.845879

"""
from typing import Sequence, Union



# revision identifiers, used by Alembic.
revision: str = '26e91c10241c'
down_revision: Union[str, Sequence[str], None] = ('20260430_add_group_chat_photo', 'eeab2498aa50')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
