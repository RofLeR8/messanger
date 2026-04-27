"""add pending status to device enum

Revision ID: 20260427_210000_add_pending_status_to_device_enum
Revises: 20260427_200000_add_updated_at_to_user_devices
Create Date: 2026-04-27 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '20260427_210000_add_pending_status_to_device_enum'
down_revision = '8afb026fc2bb'
branch_labels = None
depends_on = None


def upgrade():
    # Add PENDING value to the devicestatus enum if it doesn't exist
    # Using a DO block to check existence before adding
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum 
                WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'devicestatus')
                AND enumlabel = 'pending'
            ) THEN
                ALTER TYPE devicestatus ADD VALUE 'pending';
            END IF;
        END $$;
    """)


def downgrade():
    # Cannot remove enum values in PostgreSQL, so we do nothing here
    pass
