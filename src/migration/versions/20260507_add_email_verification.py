"""add_email_verification

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2025-05-07

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "is_verified" not in user_columns:
        op.add_column("users", sa.Column("is_verified", sa.Boolean(), default=False, nullable=False))
    if "verification_token" not in user_columns:
        op.add_column("users", sa.Column("verification_token", sa.String(length=64), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "verification_token" in user_columns:
        op.drop_column("users", "verification_token")
    if "is_verified" in user_columns:
        op.drop_column("users", "is_verified")