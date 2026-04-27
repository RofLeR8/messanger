"""add updated_at to user_devices

Revision ID: add_updated_at_to_user_devices
Revises: add_user_devices
Create Date: 2026-04-27 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_updated_at_to_user_devices"
down_revision: Union[str, Sequence[str], None] = "add_user_devices"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add updated_at column to user_devices table
    op.add_column("user_devices", sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False))


def downgrade() -> None:
    op.drop_column("user_devices", "updated_at")
