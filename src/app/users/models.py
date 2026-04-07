from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey, Text, Enum
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