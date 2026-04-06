from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class SMessageRead(BaseModel):
    id: int = Field(..., description="Message id")
    sender_id: int = Field(..., description="Sender id")
    recipient_id: Optional[int] = Field(None, description="Recipient id (None for group chats)")
    content: str = Field(..., description="Message content")
    chat_id: int = Field(..., description="Chat id")
    created_at: datetime = Field(..., description="Message created at")
    is_read: bool = Field(..., description="Message read status")
    is_delivered: bool = Field(..., description="Message delivery status")
    read_at: Optional[datetime] = Field(None, description="Message read timestamp")
    is_deleted: bool = Field(..., description="Message deleted status")
    # Editing support
    is_edited: bool = Field(..., description="Message edited status")
    edited_at: Optional[datetime] = Field(None, description="Message edited timestamp")
    edit_content: Optional[str] = Field(None, description="Edited message content")
    # Pinned messages
    is_pinned: bool = Field(..., description="Message pinned status")
    pinned_at: Optional[datetime] = Field(None, description="Message pinned timestamp")
    # File attachments
    file_url: Optional[str] = Field(None, description="File URL")
    file_type: Optional[str] = Field(None, description="File type (image, document, etc.)")
    file_name: Optional[str] = Field(None, description="File name")
    # Reply support
    in_reply_to_id: Optional[int] = Field(None, description="ID of message being replied to")
    in_reply_to_user_id: Optional[int] = Field(None, description="ID of user being replied to")
    reply_to_content: Optional[str] = Field(None, description="Content of replied message")
    reply_to_sender_name: Optional[str] = Field(None, description="Name of user being replied to")


class SMessageCreate(BaseModel):
    content: str = Field(..., description="Message content")
    file_url: Optional[str] = Field(None, description="File URL")
    file_type: Optional[str] = Field(None, description="File type (image/file)")
    file_name: Optional[str] = Field(None, description="File name")
    in_reply_to_id: Optional[int] = Field(None, description="ID of message to reply to")


class SMessageUpdate(BaseModel):
    content: Optional[str] = Field(None, description="New message content")
    is_read: Optional[bool] = None
    is_deleted: Optional[bool] = None
    is_pinned: Optional[bool] = None


class SMessageEdit(BaseModel):
    content: str = Field(..., description="New message content")


class SChatRead(BaseModel):
    id: int = Field(..., description="Chat id")
    name: Optional[str] = Field(None, description="Chat name (for group chats)")
    is_group: bool = Field(False, description="Is this a group chat")
    created_by: Optional[int] = Field(None, description="User who created the chat")
    last_message_id: Optional[int] = Field(None, description="Last message id")
    last_message_at: Optional[datetime] = Field(None, description="Last message timestamp")
    last_message_content: Optional[str] = Field(None, description="Last message content")
    last_message_sender_id: Optional[int] = Field(None, description="Last message sender id")
    unread_count: int = Field(0, description="Unread messages count")
    # Last message attachment info
    last_message_file_url: Optional[str] = Field(None, description="Last message file URL")
    last_message_file_type: Optional[str] = Field(None, description="Last message file type (image/file)")
    last_message_file_name: Optional[str] = Field(None, description="Last message file name")
    # Members info (for group chats)
    members_count: Optional[int] = Field(None, description="Number of members in the chat")


class SChatCreate(BaseModel):
    user_id: int = Field(..., description="ID of the user to chat with")


class WSMessage(BaseModel):
    """WebSocket message for sending content."""
    content: str


class WSMessageResponse(BaseModel):
    """WebSocket message response with full message data."""
    id: int
    sender_id: int
    content: str
    created_at: datetime
    is_read: bool = False
    is_delivered: bool = True
    is_edited: bool = False
    edited_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WSTypingIndicator(BaseModel):
    """WebSocket typing indicator message."""
    type: str = "typing"
    chat_id: int
    user_id: int
    is_typing: bool


class WSReadReceipt(BaseModel):
    """WebSocket read receipt message."""
    type: str = "read_receipt"
    chat_id: int
    message_ids: list[int]


# ==================== Group Chat Schemas ====================

class SGroupChatCreate(BaseModel):
    """Schema for creating a group chat."""
    name: str = Field(..., description="Group chat name", min_length=1, max_length=255)
    member_ids: List[int] = Field(..., description="List of user IDs to add as members", min_length=1)


class SChatMemberRead(BaseModel):
    """Schema for reading chat member info."""
    chat_id: int = Field(..., description="Chat id")
    user_id: int = Field(..., description="User id")
    role: str = Field(..., description="Member role (admin/member)")
    joined_at: datetime = Field(..., description="When the user joined")
    user_name: Optional[str] = Field(None, description="User name")
    user_email: Optional[str] = Field(None, description="User email")

    class Config:
        from_attributes = True


class SChatMemberAdd(BaseModel):
    """Schema for adding a member to a group chat."""
    user_id: int = Field(..., description="User ID to add")


class SChatUpdate(BaseModel):
    """Schema for updating a group chat."""
    name: Optional[str] = Field(None, description="New chat name", min_length=1, max_length=255)


class SChatDetail(BaseModel):
    """Schema for chat details response."""
    id: int = Field(..., description="Chat id")
    name: Optional[str] = Field(None, description="Chat name (for group chats)")
    is_group: bool = Field(False, description="Is this a group chat")
    created_by: Optional[int] = Field(None, description="User who created the chat")
    last_message_id: Optional[int] = Field(None, description="Last message id")
    last_message_at: Optional[datetime] = Field(None, description="Last message timestamp")
    last_message_content: Optional[str] = Field(None, description="Last message content")
    last_message_sender_id: Optional[int] = Field(None, description="Last message sender id")
    unread_count: int = Field(0, description="Unread messages count")
    members_count: Optional[int] = Field(None, description="Number of members in the chat")
    