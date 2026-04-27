from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey, Text, Enum, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from datetime import datetime, timedelta
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
    devices: Mapped[list["UserDevice"]] = relationship(
        "UserDevice",
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

    user: Mapped["User"] = relationship("User", lazy="select")


class DeviceStatus(str, enum.Enum):
    PENDING = "pending"  # Device registered but not yet verified via QR
    ACTIVE = "active"    # Device verified and active
    REVOKED = "revoked"  # Device revoked by user


class UserDevice(Base):
    __tablename__ = "user_devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    device_id: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    device_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    device_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # mobile, desktop, web
    
    # Device keys for E2EE
    device_public_key: Mapped[str] = mapped_column(Text, nullable=False)
    algorithm: Mapped[str] = mapped_column(String(64), nullable=False, default="RSA-OAEP")
    
    # Status and timestamps
    status: Mapped[DeviceStatus] = mapped_column(
        Enum(DeviceStatus), default=DeviceStatus.PENDING, nullable=False
    )
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # QR code pairing support
    pairing_token: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    pairing_token_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="devices", lazy="select")