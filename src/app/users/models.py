from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey, Text, Enum, LargeBinary
import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from datetime import datetime
from typing import Optional
import enum


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    username: Mapped[Optional[str]] = mapped_column(String(30), unique=True, nullable=True)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Online status tracking
    is_online: Mapped[bool] = mapped_column(Boolean, default=False)
    last_seen: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Account-level encryption key (encrypted with password-derived key)
    # This enables multi-device sync of chat keys
    account_key_cipher: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    account_key_nonce: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    account_key_salt: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Relationships
    friend_requests_sent: Mapped[list["Friendship"]] = relationship(
        "Friendship",
        foreign_keys="Friendship.requester_id",
        back_populates="requester",
        lazy="selectin",
    )
    friend_requests_received: Mapped[list["Friendship"]] = relationship(
        "Friendship",
        foreign_keys="Friendship.addressee_id",
        back_populates="addressee",
        lazy="selectin",
    )
    sessions: Mapped[list["UserSession"]] = relationship(
        "UserSession",
        back_populates="user",
        lazy="selectin",
        cascade="all, delete-orphan",
    )


class FriendshipStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class Friendship(Base):
    __tablename__ = "friendships"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    requester_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    addressee_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    status: Mapped[FriendshipStatus] = mapped_column(
        Enum(FriendshipStatus), default=FriendshipStatus.PENDING, nullable=False
    )

    # Relationships
    requester: Mapped["User"] = relationship(
        "User", foreign_keys=[requester_id], back_populates="friend_requests_sent"
    )
    addressee: Mapped["User"] = relationship(
        "User", foreign_keys=[addressee_id], back_populates="friend_requests_received"
    )


class UserPublicKey(Base):
    __tablename__ = "user_public_keys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    key_id: Mapped[str] = mapped_column(String(128), nullable=False)
    algorithm: Mapped[str] = mapped_column(String(64), nullable=False, default="RSA-OAEP")
    public_key: Mapped[str] = mapped_column(Text, nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=sa.text("now()"), nullable=False)

    user: Mapped["User"] = relationship("User", lazy="select")


class UserSession(Base):
    """Session model for multi-device support.
    
    Each device gets its own session with the same account encryption key.
    This allows message history to be synced across devices.
    """
    __tablename__ = "user_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    session_token: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    device_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    device_info: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # User agent, IP, etc.
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=sa.text("now()"), nullable=False)
    last_active_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="sessions", lazy="select")
