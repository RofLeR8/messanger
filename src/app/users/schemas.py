from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional
from enum import Enum


class SUserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., max_length=30, min_length=5)
    password_check: str = Field(..., max_length=30, min_length=5)
    name: str = Field(..., max_length=30)
    username: Optional[str] = Field(None, max_length=30)


class SUserAuth(BaseModel):
    email: EmailStr = Field(..., description="Email")
    password: str = Field(..., max_length=30, min_length=5)


class SUserProfile(BaseModel):
    id: int
    email: str
    name: str
    username: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    is_online: bool = False
    last_seen: Optional[datetime] = None

    class Config:
        from_attributes = True


class SUserProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=50)
    username: Optional[str] = Field(None, max_length=30)
    phone: Optional[str] = Field(None, max_length=20)
    bio: Optional[str] = None


class FriendshipStatusEnum(str, Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"


class SFriendRequest(BaseModel):
    addressee_id: int


class SFriendRead(BaseModel):
    id: int
    requester_id: int
    addressee_id: int
    status: FriendshipStatusEnum

    class Config:
        from_attributes = True


class SFriendWithDetails(BaseModel):
    id: int
    user_id: int
    name: str
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    is_online: bool = False
    last_seen: Optional[datetime] = None


class SUserPublicKeyCreate(BaseModel):
    key_id: str = Field(..., min_length=1, max_length=128)
    algorithm: str = Field(default="RSA-OAEP", min_length=1, max_length=64)
    public_key: str = Field(..., min_length=1)


class SUserPublicKeyRead(BaseModel):
    user_id: int
    key_id: str
    algorithm: str
    public_key: str
    revoked_at: Optional[datetime] = None

    class Config:
        from_attributes = True
