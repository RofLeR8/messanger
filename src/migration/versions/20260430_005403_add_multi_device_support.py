"""add_multi_device_support

Revision ID: a1b2c3d4e5f6
Revises: e8c1a7a12f01
Create Date: 2025-01-01

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'e8c1a7a12f01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # Add account encryption key columns to users table
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "account_key_cipher" not in user_columns:
        op.add_column("users", sa.Column("account_key_cipher", sa.LargeBinary(), nullable=True))
    if "account_key_nonce" not in user_columns:
        op.add_column("users", sa.Column("account_key_nonce", sa.String(), nullable=True))
    if "account_key_salt" not in user_columns:
        op.add_column("users", sa.Column("account_key_salt", sa.String(), nullable=True))

    # Create user_sessions table for multi-device support
    if "user_sessions" not in inspector.get_table_names():
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
    session_indexes = {index["name"] for index in inspector.get_indexes("user_sessions")} if "user_sessions" in inspector.get_table_names() else set()
    if "ix_user_sessions_user_id" not in session_indexes:
        op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])
    if "ix_user_sessions_session_token" not in session_indexes:
        op.create_index("ix_user_sessions_session_token", "user_sessions", ["session_token"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # Drop user_sessions table
    if "user_sessions" in inspector.get_table_names():
        session_indexes = {index["name"] for index in inspector.get_indexes("user_sessions")}
        if "ix_user_sessions_session_token" in session_indexes:
            op.drop_index("ix_user_sessions_session_token", table_name="user_sessions")
        if "ix_user_sessions_user_id" in session_indexes:
            op.drop_index("ix_user_sessions_user_id", table_name="user_sessions")
        op.drop_table("user_sessions")

    # Remove account encryption key columns from users table
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "account_key_salt" in user_columns:
        op.drop_column("users", "account_key_salt")
    if "account_key_nonce" in user_columns:
        op.drop_column("users", "account_key_nonce")
    if "account_key_cipher" in user_columns:
        op.drop_column("users", "account_key_cipher")
