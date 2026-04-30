"""add_group_chat_photo

Revision ID: 20260430_add_group_chat_photo
Revises: a1b2c3d4e5f6
Create Date: 2026-04-30
"""

from alembic import op
import sqlalchemy as sa

revision = '20260430_add_group_chat_photo'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('chats', sa.Column('photo_url', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('chats', 'photo_url')
