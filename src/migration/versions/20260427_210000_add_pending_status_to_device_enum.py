"""add pending status to device enum

Revision ID: 20260427_210000_add_pending_status_to_device_enum
Revises: 20260427_200000_add_updated_at_to_user_devices
Create Date: 2026-04-27 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '20260427_210000_add_pending_status_to_device_enum'
down_revision = '20260427_200000_add_updated_at_to_user_devices'
branch_labels = None
depends_on = None


def upgrade():
    # Add PENDING value to the devicestatus enum
    # PostgreSQL doesn't support IF NOT EXISTS for ADD VALUE before v12, so we handle it manually
    try:
        op.execute("ALTER TYPE devicestatus ADD VALUE 'pending'")
    except Exception:
        # Value might already exist, ignore error
        pass


def downgrade():
    # Cannot remove enum values in PostgreSQL, so we do nothing here
    pass
