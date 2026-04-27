"""add user devices table

Revision ID: add_user_devices
Revises: e8c1a7a12f01
Create Date: 2026-04-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_user_devices"
down_revision: Union[str, Sequence[str], None] = "e8c1a7a12f01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create user_devices table
    op.create_table(
        "user_devices",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("device_id", sa.String(length=128), nullable=False),
        sa.Column("device_name", sa.String(length=128), nullable=True),
        sa.Column("device_type", sa.String(length=64), nullable=True),
        sa.Column("device_public_key", sa.Text(), nullable=False),
        sa.Column("algorithm", sa.String(length=64), nullable=False, server_default="RSA-OAEP"),
        sa.Column("status", sa.Enum("pending", "active", "revoked", name="devicestatus"), nullable=False, server_default="pending"),
        sa.Column("last_seen_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("pairing_token", sa.String(length=128), nullable=True),
        sa.Column("pairing_token_expires_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("device_id"),
    )
    op.create_index(op.f("ix_user_devices_user_id"), "user_devices", ["user_id"], unique=False)
    op.create_index(op.f("ix_user_devices_device_id"), "user_devices", ["device_id"], unique=True)
    op.create_index(op.f("ix_user_devices_pairing_token"), "user_devices", ["pairing_token"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_devices_pairing_token"), table_name="user_devices")
    op.drop_index(op.f("ix_user_devices_device_id"), table_name="user_devices")
    op.drop_index(op.f("ix_user_devices_user_id"), table_name="user_devices")
    op.drop_table("user_devices")
    op.execute("DROP TYPE IF EXISTS devicestatus")
