"""add_multi_device_support

Revision ID: 0001a1b2c3d4
Revises: e8c1a7a12f01
Create Date: 2025-01-01

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0001a1b2c3d4'
down_revision = 'e8c1a7a12f01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add account encryption key columns to users table
    op.add_column('users', sa.Column('account_key_cipher', sa.LargeBinary(), nullable=True))
    op.add_column('users', sa.Column('account_key_nonce', sa.String(), nullable=True))
    op.add_column('users', sa.Column('account_key_salt', sa.String(), nullable=True))
    
    # Create user_sessions table for multi-device support
    op.create_table(
        'user_sessions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('session_token', sa.String(length=512), nullable=False),
        sa.Column('device_name', sa.String(length=255), nullable=True),
        sa.Column('device_info', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_active_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('is_revoked', sa.Boolean(), default=False, nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('session_token')
    )
    
    # Create index on user_id for faster session lookups
    op.create_index('ix_user_sessions_user_id', 'user_sessions', ['user_id'])
    op.create_index('ix_user_sessions_session_token', 'user_sessions', ['session_token'])


def downgrade() -> None:
    # Drop user_sessions table
    op.drop_index('ix_user_sessions_session_token', table_name='user_sessions')
    op.drop_index('ix_user_sessions_user_id', table_name='user_sessions')
    op.drop_table('user_sessions')
    
    # Remove account encryption key columns from users table
    op.drop_column('users', 'account_key_salt')
    op.drop_column('users', 'account_key_nonce')
    op.drop_column('users', 'account_key_cipher')
