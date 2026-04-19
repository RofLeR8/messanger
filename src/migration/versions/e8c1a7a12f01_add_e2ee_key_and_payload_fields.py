"""add e2ee key and payload fields

Revision ID: e8c1a7a12f01
Revises: af25278d05ab
Create Date: 2026-04-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e8c1a7a12f01"
down_revision: Union[str, Sequence[str], None] = "af25278d05ab"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_public_keys",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("key_id", sa.String(length=128), nullable=False),
        sa.Column("algorithm", sa.String(length=64), nullable=False),
        sa.Column("public_key", sa.Text(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_public_keys_user_id"), "user_public_keys", ["user_id"], unique=False)

    op.create_table(
        "chat_encrypted_keys",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("chat_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("key_id", sa.String(length=128), nullable=False),
        sa.Column("encrypted_chat_key", sa.Text(), nullable=False),
        sa.Column("key_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["chat_id"], ["chats.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chat_encrypted_keys_chat_id"), "chat_encrypted_keys", ["chat_id"], unique=False)
    op.create_index(op.f("ix_chat_encrypted_keys_user_id"), "chat_encrypted_keys", ["user_id"], unique=False)

    op.add_column("messages", sa.Column("ciphertext", sa.Text(), nullable=True))
    op.add_column("messages", sa.Column("nonce", sa.String(), nullable=True))
    op.add_column("messages", sa.Column("aad", sa.Text(), nullable=True))
    op.add_column("messages", sa.Column("encryption_version", sa.String(length=32), nullable=True))
    op.add_column("messages", sa.Column("sender_key_id", sa.String(length=128), nullable=True))


def downgrade() -> None:
    op.drop_column("messages", "sender_key_id")
    op.drop_column("messages", "encryption_version")
    op.drop_column("messages", "aad")
    op.drop_column("messages", "nonce")
    op.drop_column("messages", "ciphertext")

    op.drop_index(op.f("ix_chat_encrypted_keys_user_id"), table_name="chat_encrypted_keys")
    op.drop_index(op.f("ix_chat_encrypted_keys_chat_id"), table_name="chat_encrypted_keys")
    op.drop_table("chat_encrypted_keys")

    op.drop_index(op.f("ix_user_public_keys_user_id"), table_name="user_public_keys")
    op.drop_table("user_public_keys")
