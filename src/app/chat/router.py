from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request, Depends, HTTPException, status
import asyncio
from app.users.dependensies import get_current_user
from app.users.crud import get_all_users, get_one_by_id_or_none, set_user_online, get_users_online_status
from app.users.models import User
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from app.database import get_db
from app.chat.crud import (
    get_all_user_chats,
    get_messages_from_chat,
    create_message,
    create_direct_chat,
    create_group_chat,
    get_chat_by_id,
    mark_messages_as_read,
    soft_delete_message,
    get_chat_by_id_with_details,
    edit_message,
    pin_message,
    unpin_message,
    get_pinned_messages,
    search_messages,
    get_message_by_id,
    get_message_with_reply_info,
    is_chat_member,
    get_chat_members,
    add_member_to_chat,
    remove_member_from_chat,
    leave_group_chat,
    kick_member,
    update_chat_name,
    get_member_role,
    get_chat_members_count,
)
from app.chat.schemas import (
    SMessageCreate,
    SMessageRead,
    WSMessage,
    WSMessageResponse,
    SChatCreate,
    SChatRead,
    WSTypingIndicator,
    WSReadReceipt,
    SMessageEdit,
    SGroupChatCreate,
    SChatMemberRead,
    SChatMemberAdd,
    SChatUpdate,
    SChatDetail,
)
from app.chat.models import MemberRole
from app.websocket.manager import manager
from app.users.crud import get_one_by_id_or_none
from jose import jwt
from datetime import datetime, timezone
from app.config import get_auth_data
from typing import List

router = APIRouter(prefix="/chats", tags=["chat"])


async def _verify_user_in_chat(db: AsyncSession, chat_id: int, user_id: int):
    """Verify that a user is a member of the chat. Raises 403/404 if not."""
    chat = await get_chat_by_id(db, chat_id)
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )
    if not await is_chat_member(db, chat_id, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant of this chat"
        )
    return chat


# ==================== Chat List & Creation ====================

@router.get("/", response_model=List[SChatRead])
async def get_chats_list(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Get all chats for current user with last message and unread count."""
    current_user_id = user.id
    chats_data = await get_all_user_chats(db, current_user_id)

    result = []
    for data in chats_data:
        chat = data['chat']
        last_message = data['last_message']
        unread_count = data['unread_count']
        members_count = data['members_count']

        chat_read = SChatRead(
            id=chat.id,
            name=chat.name,
            is_group=chat.is_group,
            created_by=chat.created_by,
            last_message_id=last_message.id if last_message else None,
            last_message_at=last_message.created_at.isoformat() if last_message and last_message.created_at else None,
            last_message_content=last_message.content if last_message else None,
            last_message_sender_id=last_message.sender_id if last_message else None,
            unread_count=unread_count,
            last_message_file_url=last_message.file_url if last_message else None,
            last_message_file_type=last_message.file_type if last_message else None,
            last_message_file_name=last_message.file_name if last_message else None,
            members_count=members_count,
        )
        result.append(chat_read.model_dump())

    return result


@router.post("/", response_model=dict)
async def create_new_chat(
    chat_data: SChatCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Create a new direct chat between current user and another user."""
    current_user_id = user.id

    # Check if chat already exists
    chats_data = await get_all_user_chats(db, current_user_id)
    for data in chats_data:
        chat = data['chat']
        if not chat.is_group:
            members = await get_chat_members(db, chat.id)
            member_ids = {m.user_id for m in members}
            if member_ids == {current_user_id, chat_data.user_id}:
                return {"id": chat.id, "is_group": False}

    # Create new direct chat
    new_chat = await create_direct_chat(db, current_user_id, chat_data.user_id)
    return {"id": new_chat.id, "is_group": False}


@router.post("/group", status_code=status.HTTP_201_CREATED)
async def create_new_group_chat(
    group_data: SGroupChatCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Create a new group chat."""
    current_user_id = user.id

    # Verify all member users exist
    for member_id in group_data.member_ids:
        existing_user = await get_one_by_id_or_none(db, member_id)
        if not existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User with id {member_id} does not exist"
            )

    # Create group chat
    new_chat = await create_group_chat(db, current_user_id, group_data.name, group_data.member_ids)

    # Send notification to all new members
    for member_id in group_data.member_ids:
        if member_id != current_user_id:
            await manager.send_notification({
                "type": "added_to_group",
                "chat_id": new_chat.id,
                "chat_name": new_chat.name,
                "added_by": current_user_id,
            }, member_id)

    return {"id": new_chat.id, "name": new_chat.name, "is_group": True}


# ==================== Chat Details ====================

@router.get("/{chat_id}", response_model=SChatDetail)
async def get_chat_details(
    chat_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get chat details with last message and unread count."""
    current_user_id = user.id
    await _verify_user_in_chat(db, chat_id, current_user_id)

    chat_data = await get_chat_by_id_with_details(db, chat_id, current_user_id)
    if not chat_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )

    chat = chat_data['chat']
    last_message = chat_data['last_message']
    unread_count = chat_data['unread_count']
    members_count = chat_data['members_count']

    return SChatDetail(
        id=chat.id,
        name=chat.name,
        is_group=chat.is_group,
        created_by=chat.created_by,
        last_message_id=last_message.id if last_message else None,
        last_message_at=last_message.created_at if last_message and last_message.created_at else None,
        last_message_content=last_message.content if last_message else None,
        last_message_sender_id=last_message.sender_id if last_message else None,
        unread_count=unread_count,
        members_count=members_count,
    )


@router.put("/{chat_id}")
async def update_chat(
    chat_id: int,
    chat_update: SChatUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Update a group chat (only admin can update)."""
    current_user_id = user.id
    await _verify_user_in_chat(db, chat_id, current_user_id)

    role = await get_member_role(db, chat_id, current_user_id)
    if role != MemberRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update the group chat"
        )

    chat = await get_chat_by_id(db, chat_id)
    if not chat.is_group:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update a direct chat"
        )

    if chat_update.name is not None:
        await update_chat_name(db, chat_id, chat_update.name)

    # Broadcast update to all members
    await manager.broadcast_to_chat({
        "type": "chat_updated",
        "chat_id": chat_id,
        "name": chat_update.name,
    }, chat_id)

    return {"success": True}


# ==================== Messages ====================

@router.get("/{chat_id}/messages")
async def get_messages_list(
    chat_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0
):
    """Get messages from a chat with pagination."""
    current_user_id = user.id
    await _verify_user_in_chat(db, chat_id, current_user_id)

    messages = await get_messages_from_chat(db, chat_id, limit=limit, offset=offset)

    # Mark messages as read when loading
    await mark_messages_as_read(db, chat_id, current_user_id)

    # Broadcast read receipt to all connected users via notification channel
    await manager.broadcast_read_receipt({
        "type": "read_receipt",
        "chat_id": chat_id,
        "user_id": current_user_id
    }, chat_id, exclude_user_id=current_user_id)

    return messages


@router.post("/{chat_id}/messages", status_code=status.HTTP_201_CREATED)
async def create_message_in_chat(
    chat_id: int,
    message_data: SMessageCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Create a new message (optionally as a reply to another message or with attachment)."""
    current_user_id = user.id
    chat = await _verify_user_in_chat(db, chat_id, current_user_id)

    # For direct chats, find the other member as recipient
    recipient_id = None
    if not chat.is_group:
        members = await get_chat_members(db, chat_id)
        for m in members:
            if m.user_id != current_user_id:
                recipient_id = m.user_id
                break

    # Create the message
    message_data_result = await create_message(
        db=db,
        sender_id=current_user_id,
        recipient_id=recipient_id,
        content=message_data.content,
        chat_id=chat_id,
        in_reply_to_id=message_data.in_reply_to_id,
        file_url=message_data.file_url,
        file_type=message_data.file_type,
        file_name=message_data.file_name
    )

    # Get reply-to info for broadcast
    reply_to_info = None
    if message_data.in_reply_to_id:
        reply_msg_info = await get_message_with_reply_info(db, message_data.in_reply_to_id)
        if reply_msg_info and reply_msg_info['reply_to']:
            reply_to_info = {
                'id': reply_msg_info['reply_to']['id'],
                'sender_id': reply_msg_info['reply_to']['sender_id'],
                'content': reply_msg_info['reply_to']['content']
            }

    # Get sender name for reply_to
    reply_to_sender_name = None
    if reply_to_info and reply_to_info['sender_id']:
        reply_to_user = await get_one_by_id_or_none(db, reply_to_info['sender_id'])
        if reply_to_user:
            reply_to_sender_name = reply_to_user.name or reply_to_user.email.split('@')[0]

    # Broadcast to all connected clients in the chat
    broadcast_data = {
        "type": "new_message",
        "id": message_data_result["id"],
        "sender_id": message_data_result["sender_id"],
        "content": message_data_result["content"],
        "created_at": message_data_result["created_at"].isoformat() if message_data_result["created_at"] else None,
        "is_read": False,
        "is_delivered": True,
        "chat_id": chat_id
    }

    # Add reply info if exists
    if reply_to_info:
        broadcast_data["in_reply_to_id"] = reply_to_info["id"]
        broadcast_data["in_reply_to_user_id"] = reply_to_info["sender_id"]
        broadcast_data["reply_to_content"] = reply_to_info["content"]
        broadcast_data["reply_to_sender_name"] = reply_to_sender_name

    # Add file info if exists
    if message_data_result.get("file_url"):
        broadcast_data["file_url"] = message_data_result["file_url"]
        broadcast_data["file_type"] = message_data_result["file_type"]
        broadcast_data["file_name"] = message_data_result["file_name"]

    await manager.broadcast_to_chat(broadcast_data, chat_id)

    # Send notification to other members in group chat (excluding sender)
    if chat.is_group:
        members = await get_chat_members(db, chat_id)
        for m in members:
            if m.user_id != current_user_id:
                await manager.send_notification(broadcast_data, m.user_id)
    elif recipient_id:
        await manager.send_notification(broadcast_data, recipient_id)

    return message_data_result


@router.post("/{chat_id}/messages/read")
async def mark_chat_messages_as_read(
    chat_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Mark all unread messages in a chat as read."""
    current_user_id = user.id
    await _verify_user_in_chat(db, chat_id, current_user_id)

    count = await mark_messages_as_read(db, chat_id, current_user_id)

    # Broadcast read receipt to other participants
    await manager.broadcast_to_chat({
        "type": "read_receipt",
        "chat_id": chat_id,
        "user_id": current_user_id,
        "read_count": count
    }, chat_id, exclude_user_id=current_user_id)

    return {"read_count": count}


@router.delete("/{chat_id}/messages/{message_id}")
async def delete_message(
    chat_id: int,
    message_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Soft delete a message (only sender or admin can delete)."""
    current_user_id = user.id
    await _verify_user_in_chat(db, chat_id, current_user_id)

    message = await soft_delete_message(db, message_id, current_user_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found or you can't delete it"
        )

    # Broadcast deletion
    await manager.broadcast_to_chat({
        "type": "message_deleted",
        "message_id": message_id,
        "chat_id": chat_id
    }, chat_id)

    return {"success": True}


@router.put("/{chat_id}/messages/{message_id}/edit")
async def edit_message_endpoint(
    chat_id: int,
    message_id: int,
    edit_data: SMessageEdit,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Edit a message (only sender can edit)."""
    current_user_id = user.id
    await _verify_user_in_chat(db, chat_id, current_user_id)

    message = await edit_message(db, message_id, current_user_id, edit_data.content)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found or you can't edit it"
        )

    # Broadcast edit notification
    await manager.broadcast_to_chat({
        "type": "message_edited",
        "message_id": message_id,
        "chat_id": chat_id,
        "content": message.content,
        "is_edited": True,
        "edited_at": message.edited_at.isoformat() if message.edited_at else None
    }, chat_id)

    return {
        "success": True,
        "id": message.id,
        "content": message.content,
        "is_edited": message.is_edited,
        "edited_at": message.edited_at
    }


@router.post("/{chat_id}/messages/{message_id}/pin")
async def pin_message_endpoint(
    chat_id: int,
    message_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Pin a message in a chat."""
    current_user_id = user.id
    await _verify_user_in_chat(db, chat_id, current_user_id)

    message = await pin_message(db, message_id, current_user_id, chat_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    # Broadcast pin notification
    await manager.broadcast_to_chat({
        "type": "message_pinned",
        "message_id": message_id,
        "chat_id": chat_id,
        "pinned_by": current_user_id
    }, chat_id)

    return {"success": True}


@router.post("/{chat_id}/messages/{message_id}/unpin")
async def unpin_message_endpoint(
    chat_id: int,
    message_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Unpin a message."""
    current_user_id = user.id
    await _verify_user_in_chat(db, chat_id, current_user_id)

    message = await unpin_message(db, message_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    # Broadcast unpin notification
    await manager.broadcast_to_chat({
        "type": "message_unpinned",
        "message_id": message_id,
        "chat_id": chat_id
    }, chat_id)

    return {"success": True}


@router.get("/{chat_id}/messages/pinned")
async def get_pinned_messages_endpoint(
    chat_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get all pinned messages in a chat."""
    current_user_id = user.id
    await _verify_user_in_chat(db, chat_id, current_user_id)

    pinned_messages = await get_pinned_messages(db, chat_id)
    return pinned_messages


@router.get("/{chat_id}/messages/search")
async def search_messages_endpoint(
    chat_id: int,
    q: str,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Search messages in a chat by content."""
    current_user_id = user.id
    await _verify_user_in_chat(db, chat_id, current_user_id)

    if not q or len(q) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query must be at least 2 characters"
        )

    messages = await search_messages(db, chat_id, q, limit=limit, offset=offset)
    return messages


# ==================== Group Chat Members ====================

@router.get("/{chat_id}/members", response_model=List[SChatMemberRead])
async def get_chat_members_endpoint(
    chat_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get all members of a chat."""
    current_user_id = user.id
    await _verify_user_in_chat(db, chat_id, current_user_id)

    members = await get_chat_members(db, chat_id)
    result = []
    for member in members:
        member_data = SChatMemberRead(
            chat_id=member.chat_id,
            user_id=member.user_id,
            role=member.role.value,
            joined_at=member.joined_at,
            user_name=member.user.name if member.user else None,
            user_email=member.user.email if member.user else None,
        )
        result.append(member_data.model_dump())

    return result


@router.post("/{chat_id}/members", status_code=status.HTTP_201_CREATED)
async def add_member_endpoint(
    chat_id: int,
    member_data: SChatMemberAdd,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Add a member to a group chat (only admin can add)."""
    current_user_id = user.id
    chat = await _verify_user_in_chat(db, chat_id, current_user_id)

    if not chat.is_group:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add members to a direct chat"
        )

    role = await get_member_role(db, chat_id, current_user_id)
    if role != MemberRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can add members"
        )

    # Check if user exists
    new_member = await get_one_by_id_or_none(db, member_data.user_id)
    if not new_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not exist"
        )

    # Add member
    result = await add_member_to_chat(db, chat_id, member_data.user_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this chat"
        )

    # Broadcast member added
    await manager.broadcast_to_chat({
        "type": "member_added",
        "chat_id": chat_id,
        "user_id": member_data.user_id,
        "user_name": new_member.name,
        "added_by": current_user_id,
    }, chat_id)

    # Send notification to the new member
    await manager.send_notification({
        "type": "added_to_group",
        "chat_id": chat_id,
        "chat_name": chat.name,
        "added_by": current_user_id,
    }, member_data.user_id)

    return {"success": True, "user_id": member_data.user_id}


@router.delete("/{chat_id}/members/{user_id}")
async def remove_member_endpoint(
    chat_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Remove a member from a group chat (or leave if removing self)."""
    current_user_id = user.id
    chat = await _verify_user_in_chat(db, chat_id, current_user_id)

    if not chat.is_group:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove members from a direct chat"
        )

    # Leaving the group
    if user_id == current_user_id:
        result = await leave_group_chat(db, chat_id, current_user_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to leave the group"
            )

        await manager.broadcast_to_chat({
            "type": "member_left",
            "chat_id": chat_id,
            "user_id": current_user_id,
        }, chat_id)

        manager.disconnect_user_from_chat(current_user_id, chat_id)

        return {"success": True, "action": "left"}

    # Kicking another member (admin only)
    role = await get_member_role(db, chat_id, current_user_id)
    if role != MemberRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can remove members"
        )

    result = await kick_member(db, chat_id, current_user_id, user_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to remove member (they may be an admin or don't exist)"
        )

    # Get kicked user name
    kicked_user = await get_one_by_id_or_none(db, user_id)
    kicked_user_name = kicked_user.name if kicked_user else None

    await manager.broadcast_to_chat({
        "type": "member_removed",
        "chat_id": chat_id,
        "user_id": user_id,
        "user_name": kicked_user_name,
        "removed_by": current_user_id,
    }, chat_id)

    # Disconnect kicked user from chat
    manager.disconnect_user_from_chat(user_id, chat_id)

    # Send notification to kicked user
    if kicked_user_name:
        await manager.send_notification({
            "type": "removed_from_group",
            "chat_id": chat_id,
            "chat_name": chat.name,
            "removed_by": current_user_id,
        }, user_id)

    return {"success": True, "action": "removed"}


# ==================== WebSocket ====================

@router.websocket("/ws/{chat_id}")
async def websocket_chat_connection(
    websocket: WebSocket,
    chat_id: int,
    db: AsyncSession = Depends(get_db)
):
    """WebSocket endpoint for real-time chat messages, typing indicators, and read receipts."""
    # Get token from cookies or query param
    token = websocket.cookies.get("user_access_token")
    if not token:
        token = websocket.query_params.get("token")

    if not token:
        await websocket.close(code=4001, reason="Missing authentication token")
        return

    # Validate token and get user
    try:
        auth_data = get_auth_data()
        payload = jwt.decode(token, auth_data["secret_key"], algorithms=auth_data["algorithm"])
        expire = payload.get("exp")
        if not expire:
            await websocket.close(code=4001, reason="Invalid token")
            return

        expire_time = datetime.fromtimestamp(int(expire), tz=timezone.utc)
        if expire_time < datetime.now(timezone.utc):
            await websocket.close(code=4001, reason="Token expired")
            return

        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001, reason="Invalid token payload")
            return

        current_user_id = int(user_id)

        user = await get_one_by_id_or_none(db, current_user_id)
        if not user:
            await websocket.close(code=4001, reason="User not found")
            return

    except Exception as e:
        await websocket.close(code=4001, reason=f"Authentication failed: {str(e)}")
        return

    # Check if chat exists and user is a participant
    chat = await get_chat_by_id(db, chat_id)
    if not chat:
        await websocket.close(code=4003, reason="Chat not found")
        return

    if not await is_chat_member(db, chat_id, current_user_id):
        await websocket.close(code=4003, reason="You are not a participant of this chat")
        return

    # Capture values from chat object BEFORE any commit (commits expire objects)
    chat_is_group = chat.is_group

    # Get all other members for notifications
    members = await get_chat_members(db, chat_id)
    other_member_ids = [m.user_id for m in members if m.user_id != current_user_id]

    # Connect to the chat
    await manager.connect(websocket, current_user_id, chat_id)

    # Update user's online status in DB
    await set_user_online(db, current_user_id, True)

    # Send initial chat state
    await websocket.send_json({
        "type": "connected",
        "chat_id": chat_id,
        "user_id": current_user_id
    })

    # Broadcast online status (ignore errors so we don't crash the WS)
    try:
        await manager.broadcast_user_status(current_user_id, True)
    except Exception as e:
        print(f"WS broadcast_user_status error (non-fatal): {e}")

    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type", "message")

            if message_type == "typing":
                is_typing = data.get("is_typing", False)
                await manager.broadcast_to_chat({
                    "type": "typing",
                    "chat_id": chat_id,
                    "user_id": current_user_id,
                    "is_typing": is_typing
                }, chat_id, exclude_user_id=current_user_id)

            elif message_type == "read_receipt":
                await mark_messages_as_read(db, chat_id, current_user_id)
                await manager.broadcast_read_receipt({
                    "type": "read_receipt",
                    "chat_id": chat_id,
                    "user_id": current_user_id
                }, chat_id, exclude_user_id=current_user_id)

            else:
                content = data.get("content", "").strip()
                in_reply_to_id = data.get("in_reply_to_id")
                file_url = data.get("file_url")
                file_type = data.get("file_type")
                file_name = data.get("file_name")

                if not content and not file_url:
                    continue

                # Determine recipient for direct chats
                recipient_id = None
                if not chat_is_group and other_member_ids:
                    recipient_id = other_member_ids[0]

                # Save message to database
                message_data = await create_message(
                    db=db,
                    sender_id=current_user_id,
                    recipient_id=recipient_id,
                    content=content,
                    chat_id=chat_id,
                    in_reply_to_id=in_reply_to_id,
                    file_url=file_url,
                    file_type=file_type,
                    file_name=file_name
                )

                # Get reply-to info for broadcast
                reply_to_info = None
                reply_to_sender_name = None

                if in_reply_to_id:
                    reply_to_msg = await get_message_by_id(db, in_reply_to_id)
                    if reply_to_msg:
                        reply_to_info = {
                            'id': reply_to_msg.id,
                            'sender_id': reply_to_msg.sender_id,
                            'content': reply_to_msg.content[:100] + '...' if len(reply_to_msg.content) > 100 else reply_to_msg.content
                        }
                        reply_to_user = await get_one_by_id_or_none(db, reply_to_msg.sender_id)
                        reply_to_sender_name = reply_to_user.name if reply_to_user else None

                # Broadcast to all connected clients in the chat
                broadcast_data = {
                    "type": "new_message",
                    "id": message_data["id"],
                    "sender_id": message_data["sender_id"],
                    "content": message_data["content"],
                    "created_at": message_data["created_at"].isoformat() if message_data["created_at"] else None,
                    "is_read": False,
                    "is_delivered": True,
                    "chat_id": chat_id
                }

                if reply_to_info:
                    broadcast_data["in_reply_to_id"] = reply_to_info["id"]
                    broadcast_data["in_reply_to_user_id"] = reply_to_info["sender_id"]
                    broadcast_data["reply_to_content"] = reply_to_info["content"]
                    broadcast_data["reply_to_sender_name"] = reply_to_sender_name

                if file_url:
                    broadcast_data["file_url"] = file_url
                    broadcast_data["file_type"] = file_type
                    broadcast_data["file_name"] = file_name

                await manager.broadcast_to_chat(broadcast_data, chat_id)

                # Send notification to other members
                for member_id in other_member_ids:
                    await manager.send_notification(broadcast_data, member_id)

    except WebSocketDisconnect:
        manager.disconnect(websocket, current_user_id, chat_id)
        # Only set offline if no other connections (chat or notification)
        if not manager.active_connections.get(current_user_id) and current_user_id not in manager.notification_connections:
            await set_user_online(db, current_user_id, False)
            await manager.broadcast_user_status(current_user_id, False)
    except asyncio.CancelledError:
        manager.disconnect(websocket, current_user_id, chat_id)
        if not manager.active_connections.get(current_user_id) and current_user_id not in manager.notification_connections:
            await set_user_online(db, current_user_id, False)
            await manager.broadcast_user_status(current_user_id, False)
        raise
    except Exception as e:
        manager.disconnect(websocket, current_user_id, chat_id)
        if not manager.active_connections.get(current_user_id) and current_user_id not in manager.notification_connections:
            await set_user_online(db, current_user_id, False)
            await manager.broadcast_user_status(current_user_id, False)
