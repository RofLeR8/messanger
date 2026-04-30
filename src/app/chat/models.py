from sqlalchemy import Integer, String, ForeignKey, Text, Boolean, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
import enum
import sqlalchemy as sa

if TYPE_CHECKING:
    from app.users.models import User


class MemberRole(str, enum.Enum):
    admin = "admin"
    member = "member"


class ChatMember(Base):
    __tablename__ = "chat_members"

    chat_id: Mapped[int] = mapped_column(Integer, ForeignKey("chats.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), primary_key=True)
    role: Mapped[MemberRole] = mapped_column(
        Enum(MemberRole, create_constraint=True, name="memberrole"),
        default=MemberRole.member
    )
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    # Relationships
    chat: Mapped["Chat"] = relationship(back_populates="members", lazy="select")
    user: Mapped["User"] = relationship(lazy="select")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sender_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    recipient_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    content: Mapped[str] = mapped_column(Text)
    chat_id: Mapped[int] = mapped_column(Integer, ForeignKey("chats.id"))

    # Message status fields
    is_delivered: Mapped[bool] = mapped_column(Boolean, default=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Soft delete support
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Message editing support
    edit_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    edited_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_edited: Mapped[bool] = mapped_column(Boolean, default=False)

    # Pinned messages
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    pinned_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    pinned_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)

    # File attachments
    file_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    file_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # image, document, etc.
    file_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Reply to message
    in_reply_to_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("messages.id"), nullable=True)
    in_reply_to_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)

    # E2EE payload fields (ciphertext is always server-stored for encrypted messages)
    ciphertext: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    nonce: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    aad: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    encryption_version: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    sender_key_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    # Relationships
    chat: Mapped["Chat"] = relationship(
        back_populates="messages",
        foreign_keys=[chat_id],
        lazy="select"
    )
    reply_to: Mapped[Optional["Message"]] = relationship(
        foreign_keys=[in_reply_to_id],
        lazy="select"
    )


class Chat(Base):
    __tablename__ = "chats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_group: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)

    # Last message tracking
    last_message_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("messages.id"), nullable=True)
    last_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    messages: Mapped[List["Message"]] = relationship(
        back_populates="chat",
        foreign_keys="Message.chat_id",
        lazy="select"
    )
    last_message: Mapped[Optional["Message"]] = relationship(
        foreign_keys=[last_message_id],
        lazy="select"
    )
    members: Mapped[List["ChatMember"]] = relationship(
        back_populates="chat",
        lazy="select"
    )


class ChatEncryptedKey(Base):
    __tablename__ = "chat_encrypted_keys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chat_id: Mapped[int] = mapped_column(Integer, ForeignKey("chats.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    key_id: Mapped[str] = mapped_column(String(128), nullable=False)
    encrypted_chat_key: Mapped[str] = mapped_column(Text, nullable=False)
    key_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=sa.text("now()"), nullable=False)

    chat: Mapped["Chat"] = relationship("Chat", lazy="select")
