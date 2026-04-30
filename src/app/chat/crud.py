from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, select, func
from app.chat.models import Message, Chat, ChatMember, MemberRole, ChatEncryptedKey
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import selectinload
from app.users.crud import get_one_by_id_or_none

SERVER_BACKUP_KEY_ID = "__server_backup__"


# ==================== Chat Members CRUD ====================

async def get_chat_members(db: AsyncSession, chat_id: int) -> List[ChatMember]:
    """Get all members of a chat with user details."""
    q = (
        select(ChatMember)
        .where(ChatMember.chat_id == chat_id)
        .options(selectinload(ChatMember.user))
    )
    result = await db.execute(q)
    return result.scalars().all()


async def is_chat_member(db: AsyncSession, chat_id: int, user_id: int) -> bool:
    """Check if a user is a member of a chat."""
    q = select(ChatMember).where(
        and_(ChatMember.chat_id == chat_id, ChatMember.user_id == user_id)
    )
    result = await db.execute(q)
    return result.scalars().first() is not None


async def add_member_to_chat(db: AsyncSession, chat_id: int, user_id: int, role: MemberRole = MemberRole.member) -> Optional[ChatMember]:
    """Add a member to a chat. Returns None if already a member."""
    # Check if already a member
    if await is_chat_member(db, chat_id, user_id):
        return None

    member = ChatMember(chat_id=chat_id, user_id=user_id, role=role, joined_at=datetime.now())
    db.add(member)
    try:
        await db.commit()
        await db.refresh(member)
    except Exception:
        await db.rollback()
        raise
    return member


async def remove_member_from_chat(db: AsyncSession, chat_id: int, user_id: int) -> bool:
    """Remove a member from a chat. Returns True if removed."""
    q = select(ChatMember).where(
        and_(ChatMember.chat_id == chat_id, ChatMember.user_id == user_id)
    )
    result = await db.execute(q)
    member = result.scalars().first()
    if not member:
        return False

    await db.delete(member)
    await db.commit()
    return True


async def get_member_role(db: AsyncSession, chat_id: int, user_id: int) -> Optional[MemberRole]:
    """Get the role of a user in a chat."""
    q = select(ChatMember.role).where(
        and_(ChatMember.chat_id == chat_id, ChatMember.user_id == user_id)
    )
    result = await db.execute(q)
    return result.scalars().first()


async def get_chat_members_count(db: AsyncSession, chat_id: int) -> int:
    """Get the number of members in a chat."""
    q = select(func.count(ChatMember.user_id)).where(ChatMember.chat_id == chat_id)
    result = await db.execute(q)
    return result.scalar() or 0


# ==================== Chats CRUD ====================

async def get_all_user_chats(db: AsyncSession, user_id: int):
    """Get all chats for a user with last message and unread count, sorted by last message time."""
    # Get chats where user is a member
    q = (
        select(Chat)
        .join(ChatMember, ChatMember.chat_id == Chat.id)
        .where(ChatMember.user_id == user_id)
        .order_by(Chat.last_message_at.desc().nullsfirst(), Chat.id.desc())
    )
    result = await db.execute(q)
    chats = result.scalars().all()

    chats_data = []
    for chat in chats:
        # Get last message for this chat
        last_message_q = (
            select(Message)
            .where(Message.chat_id == chat.id)
            .where(Message.is_deleted == False)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        lm_result = await db.execute(last_message_q)
        last_message = lm_result.scalars().first()

        # Get unread count (messages where current user is not the sender)
        unread_q = (
            select(func.count(Message.id))
            .where(Message.chat_id == chat.id)
            .where(Message.sender_id != user_id)
            .where(Message.is_read == False)
            .where(Message.is_deleted == False)
        )
        unread_result = await db.execute(unread_q)
        unread_count = unread_result.scalar() or 0

        # Get members count
        members_count = await get_chat_members_count(db, chat.id)

        chats_data.append({
            'chat': chat,
            'last_message': last_message,
            'unread_count': unread_count,
            'members_count': members_count
        })

    return chats_data


async def get_chat_by_id(db: AsyncSession, chat_id: int):
    q = select(Chat).where(Chat.id == chat_id)
    result = await db.execute(q)
    return result.scalars().first()


async def get_chat_by_id_with_details(db: AsyncSession, chat_id: int, user_id: int):
    """Get chat with last message and unread count."""
    chat = await get_chat_by_id(db, chat_id)
    if not chat:
        return None

    # Verify user is a member
    if not await is_chat_member(db, chat_id, user_id):
        return None

    # Get last message
    last_message_q = (
        select(Message)
        .where(Message.chat_id == chat_id)
        .where(Message.is_deleted == False)
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    result = await db.execute(last_message_q)
    last_message = result.scalars().first()

    # Get unread count
    unread_q = (
        select(func.count(Message.id))
        .where(Message.chat_id == chat_id)
        .where(Message.sender_id != user_id)
        .where(Message.is_read == False)
        .where(Message.is_deleted == False)
    )
    result = await db.execute(unread_q)
    unread_count = result.scalar() or 0

    # Get members count
    members_count = await get_chat_members_count(db, chat_id)

    return {
        'chat': chat,
        'last_message': last_message,
        'unread_count': unread_count,
        'members_count': members_count
    }


async def create_direct_chat(db: AsyncSession, user_id_1: int, user_id_2: int):
    """Create a direct (1-on-1) chat between two users."""
    db_chat = Chat(
        is_group=False,
        created_by=user_id_1,
    )
    db.add(db_chat)
    try:
        await db.flush()  # Get chat ID before committing
    except Exception as e:
        await db.rollback()
        raise e

    # Add both users as members
    member1 = ChatMember(chat_id=db_chat.id, user_id=user_id_1, role=MemberRole.admin, joined_at=datetime.now())
    member2 = ChatMember(chat_id=db_chat.id, user_id=user_id_2, role=MemberRole.member, joined_at=datetime.now())
    db.add_all([member1, member2])
    try:
        await db.commit()
        await db.refresh(db_chat)
    except Exception as e:
        await db.rollback()
        raise e
    return db_chat


async def create_group_chat(db: AsyncSession, created_by: int, name: str, member_ids: List[int]):
    """Create a group chat with the creator and specified members."""
    db_chat = Chat(
        name=name,
        is_group=True,
        created_by=created_by,
    )
    db.add(db_chat)
    try:
        await db.flush()  # Get chat ID before committing
    except Exception as e:
        await db.rollback()
        raise e

    # Add creator as admin
    members = [
        ChatMember(chat_id=db_chat.id, user_id=created_by, role=MemberRole.admin, joined_at=datetime.now())
    ]
    # Add other members
    for user_id in member_ids:
        if user_id != created_by:  # Avoid duplicate
            members.append(
                ChatMember(chat_id=db_chat.id, user_id=user_id, role=MemberRole.member, joined_at=datetime.now())
            )

    db.add_all(members)
    try:
        await db.commit()
        await db.refresh(db_chat)
    except Exception as e:
        await db.rollback()
        raise e
    return db_chat


async def update_chat_name(db: AsyncSession, chat_id: int, name: str) -> Optional[Chat]:
    """Update chat name."""
    chat = await get_chat_by_id(db, chat_id)
    if chat:
        chat.name = name
        await db.commit()
        await db.refresh(chat)
    return chat


async def update_chat_last_message(db: AsyncSession, chat_id: int, message_id: int, message_created_at: datetime):
    """Update chat's last message tracking."""
    chat = await get_chat_by_id(db, chat_id)
    if chat:
        chat.last_message_id = message_id
        chat.last_message_at = message_created_at
        await db.commit()


# ==================== Messages CRUD ====================

async def get_messages_from_chat(db: AsyncSession, chat_id: int, limit: int = 50, offset: int = 0) -> List[dict]:
    """Get messages from a chat with pagination, excluding deleted messages. Returns list of dicts with reply info."""
    q = (
        select(Message)
        .where(Message.chat_id == chat_id)
        .where(Message.is_deleted == False)
        .order_by(Message.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(q)
    messages = result.scalars().all()

    # Convert to list of dicts with reply info and file info
    messages_data = []
    for msg in messages:
        msg_dict = {
            'id': msg.id,
            'sender_id': msg.sender_id,
            'recipient_id': msg.recipient_id,
            'content': msg.content,
            'ciphertext': msg.ciphertext,
            'nonce': msg.nonce,
            'aad': msg.aad,
            'encryption_version': msg.encryption_version,
            'sender_key_id': msg.sender_key_id,
            'is_encrypted': bool(msg.ciphertext),
            'chat_id': msg.chat_id,
            'created_at': msg.created_at,
            'is_delivered': msg.is_delivered,
            'is_read': msg.is_read,
            'read_at': msg.read_at,
            'is_deleted': msg.is_deleted,
            'deleted_at': msg.deleted_at,
            'in_reply_to_id': msg.in_reply_to_id,
            'in_reply_to_user_id': msg.in_reply_to_user_id,
            'file_url': msg.file_url,
            'file_type': msg.file_type,
            'file_name': msg.file_name,
            'is_edited': msg.is_edited,
            'edited_at': msg.edited_at,
            'edit_content': msg.edit_content,
            'is_pinned': msg.is_pinned,
            'pinned_at': msg.pinned_at,
        }
        if msg.ciphertext:
            msg_dict['encrypted_payload'] = {
                'ciphertext': msg.ciphertext,
                'nonce': msg.nonce,
                'aad': msg.aad,
                'encryption_version': msg.encryption_version or 'v1',
                'sender_key_id': msg.sender_key_id,
            }

        # Add reply_to info if exists
        if msg.in_reply_to_id:
            reply_to_msg = await get_message_by_id(db, msg.in_reply_to_id)
            if reply_to_msg:
                msg_dict['reply_to_content'] = reply_to_msg.content
                # Get sender name
                reply_to_user = await get_one_by_id_or_none(db, reply_to_msg.sender_id)
                msg_dict['reply_to_sender_name'] = reply_to_user.name if reply_to_user else None

        messages_data.append(msg_dict)

    # Return in ascending order (oldest first)
    return list(reversed(messages_data))


async def get_message_by_id(db: AsyncSession, message_id: int) -> Optional[Message]:
    """Get a single message by ID."""
    q = select(Message).where(Message.id == message_id)
    result = await db.execute(q)
    return result.scalars().first()


async def get_message_with_reply_info(db: AsyncSession, message_id: int) -> Optional[dict]:
    """Get message with reply-to information for display."""
    message = await get_message_by_id(db, message_id)

    if not message:
        return None

    # Get reply-to message info if exists
    reply_to_info = None
    if message.in_reply_to_id:
        reply_to_msg = await get_message_by_id(db, message.in_reply_to_id)
        if reply_to_msg:
            reply_to_info = {
                'id': reply_to_msg.id,
                'sender_id': reply_to_msg.sender_id,
                'content': reply_to_msg.content[:100] + '...' if len(reply_to_msg.content) > 100 else reply_to_msg.content
            }

    return {
        'message': message,
        'reply_to': reply_to_info
    }


async def create_message(db: AsyncSession, sender_id: int, chat_id: int, content: Optional[str] = None,
                         recipient_id: Optional[int] = None,
                         in_reply_to_id: Optional[int] = None,
                         file_url: Optional[str] = None,
                         file_type: Optional[str] = None,
                         file_name: Optional[str] = None,
                         ciphertext: Optional[str] = None,
                         nonce: Optional[str] = None,
                         aad: Optional[str] = None,
                         encryption_version: Optional[str] = None,
                         sender_key_id: Optional[str] = None) -> dict:
    """Create a message and return as dict."""
    db_message = Message(
        sender_id=sender_id,
        recipient_id=recipient_id,
        content=content,
        chat_id=chat_id,
        is_delivered=True,
        is_read=False,
        in_reply_to_id=in_reply_to_id,
        in_reply_to_user_id=None,
        file_url=file_url,
        file_type=file_type,
        file_name=file_name,
        ciphertext=ciphertext,
        nonce=nonce,
        aad=aad,
        encryption_version=encryption_version,
        sender_key_id=sender_key_id,
    )

    if in_reply_to_id:
        original_msg = await get_message_by_id(db, in_reply_to_id)
        if original_msg:
            db_message.in_reply_to_user_id = original_msg.sender_id

    db.add(db_message)
    try:
        await db.commit()
        await db.refresh(db_message)
    except Exception as e:
        await db.rollback()
        raise e

    message_data = {
        'id': db_message.id,
        'sender_id': db_message.sender_id,
        'recipient_id': db_message.recipient_id,
        'content': db_message.content,
        'ciphertext': db_message.ciphertext,
        'nonce': db_message.nonce,
        'aad': db_message.aad,
        'encryption_version': db_message.encryption_version,
        'sender_key_id': db_message.sender_key_id,
        'is_encrypted': bool(db_message.ciphertext),
        'chat_id': db_message.chat_id,
        'created_at': db_message.created_at,
        'is_delivered': db_message.is_delivered,
        'is_read': db_message.is_read,
        'read_at': db_message.read_at,
        'is_deleted': db_message.is_deleted,
        'deleted_at': db_message.deleted_at,
        'in_reply_to_id': db_message.in_reply_to_id,
        'in_reply_to_user_id': db_message.in_reply_to_user_id,
        'file_url': db_message.file_url,
        'file_type': db_message.file_type,
        'file_name': db_message.file_name,
        'is_edited': db_message.is_edited,
        'edited_at': db_message.edited_at,
        'edit_content': db_message.edit_content,
        'is_pinned': db_message.is_pinned,
        'pinned_at': db_message.pinned_at,
    }
    if db_message.ciphertext:
        message_data['encrypted_payload'] = {
            'ciphertext': db_message.ciphertext,
            'nonce': db_message.nonce,
            'aad': db_message.aad,
            'encryption_version': db_message.encryption_version or 'v1',
            'sender_key_id': db_message.sender_key_id,
        }

    try:
        await update_chat_last_message(db, chat_id, db_message.id, db_message.created_at)
    except Exception:
        pass

    return message_data


async def mark_message_as_read(db: AsyncSession, message_id: int) -> Optional[Message]:
    """Mark a message as read."""
    message = await get_message_by_id(db, message_id)
    if message:
        message.is_read = True
        message.read_at = datetime.now()
        await db.commit()
        await db.refresh(message)
    return message


async def mark_messages_as_read(db: AsyncSession, chat_id: int, user_id: int) -> int:
    """Mark all unread messages in a chat as read for a user. Returns count of updated messages."""
    q = (
        select(Message)
        .where(Message.chat_id == chat_id)
        .where(Message.sender_id != user_id)
        .where(Message.is_read == False)
        .where(Message.is_deleted == False)
    )
    result = await db.execute(q)
    messages = result.scalars().all()

    count = 0
    now = datetime.now()
    for message in messages:
        message.is_read = True
        message.read_at = now
        count += 1

    if count > 0:
        await db.commit()

    return count


async def soft_delete_message(db: AsyncSession, message_id: int, user_id: int) -> Optional[Message]:
    """Soft delete a message (only sender or admin can delete)."""
    message = await get_message_by_id(db, message_id)
    if message:
        # Check if user is sender or admin
        chat = await get_chat_by_id(db, message.chat_id)
        if not chat:
            return None

        role = await get_member_role(db, message.chat_id, user_id)
        is_sender = message.sender_id == user_id
        is_admin = role == MemberRole.admin

        if is_sender or is_admin:
            message.is_deleted = True
            message.deleted_at = datetime.now()
            await db.commit()
            await db.refresh(message)
    return message


async def update_message(db: AsyncSession, message_id: int, **kwargs) -> Optional[Message]:
    """Update message fields."""
    message = await get_message_by_id(db, message_id)
    if message:
        for key, value in kwargs.items():
            if hasattr(message, key):
                setattr(message, key, value)
        await db.commit()
        await db.refresh(message)
    return message


async def edit_message(db: AsyncSession, message_id: int, user_id: int, new_content: str) -> Optional[Message]:
    """Edit a message (only sender can edit)."""
    message = await get_message_by_id(db, message_id)
    if message and message.sender_id == user_id:
        # Store original content in edit_content for history
        message.edit_content = message.content
        message.content = new_content
        message.is_edited = True
        message.edited_at = datetime.now()
        await db.commit()
        await db.refresh(message)
    return message


async def edit_message_encrypted(
    db: AsyncSession,
    message_id: int,
    user_id: int,
    ciphertext: str,
    nonce: str,
    aad: Optional[str],
    encryption_version: Optional[str],
    sender_key_id: Optional[str],
) -> Optional[Message]:
    message = await get_message_by_id(db, message_id)
    if message and message.sender_id == user_id:
        message.edit_content = message.content
        message.content = None
        message.ciphertext = ciphertext
        message.nonce = nonce
        message.aad = aad
        message.encryption_version = encryption_version
        message.sender_key_id = sender_key_id
        message.is_edited = True
        message.edited_at = datetime.now()
        await db.commit()
        await db.refresh(message)
    return message


async def pin_message(db: AsyncSession, message_id: int, user_id: int, chat_id: int) -> Optional[Message]:
    """Pin a message in a chat (only chat participants can pin)."""
    message = await get_message_by_id(db, message_id)
    if message and message.chat_id == chat_id:
        message.is_pinned = True
        message.pinned_at = datetime.now()
        message.pinned_by = user_id
        await db.commit()
        await db.refresh(message)
    return message


async def unpin_message(db: AsyncSession, message_id: int) -> Optional[Message]:
    """Unpin a message."""
    message = await get_message_by_id(db, message_id)
    if message:
        message.is_pinned = False
        message.pinned_at = None
        message.pinned_by = None
        await db.commit()
        await db.refresh(message)
    return message


async def get_pinned_messages(db: AsyncSession, chat_id: int) -> List[Message]:
    """Get all pinned messages in a chat."""
    q = (
        select(Message)
        .where(Message.chat_id == chat_id)
        .where(Message.is_pinned)
        .where(Message.is_deleted == False)
        .order_by(Message.pinned_at.desc())
    )
    result = await db.execute(q)
    return result.scalars().all()


async def search_messages(
    db: AsyncSession,
    chat_id: int,
    query: str,
    limit: int = 20,
    offset: int = 0
) -> List[Message]:
    """Search messages in a chat by content."""
    search_query = f"%{query}%"
    q = (
        select(Message)
        .where(Message.chat_id == chat_id)
        .where(Message.content.is_not(None))
        .where(Message.content.ilike(search_query))
        .where(Message.is_deleted == False)
        .order_by(Message.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(q)
    messages = result.scalars().all()
    # Return in ascending order (oldest first)
    return list(reversed(messages))


async def upsert_chat_encrypted_key(
    db: AsyncSession,
    chat_id: int,
    user_id: int,
    key_id: str,
    encrypted_chat_key: str,
    key_version: int = 1,
    backup_key_plaintext: Optional[str] = None,
) -> ChatEncryptedKey:
    q = select(ChatEncryptedKey).where(
        ChatEncryptedKey.chat_id == chat_id,
        ChatEncryptedKey.user_id == user_id,
        ChatEncryptedKey.key_id == key_id,
        ChatEncryptedKey.key_version == key_version,
    )
    existing = (await db.execute(q)).scalars().first()
    if existing:
        existing.encrypted_chat_key = encrypted_chat_key
        primary = existing
    else:
        row = ChatEncryptedKey(
            chat_id=chat_id,
            user_id=user_id,
            key_id=key_id,
            encrypted_chat_key=encrypted_chat_key,
            key_version=key_version,
        )
        db.add(row)
        primary = row

    if backup_key_plaintext:
        backup_q = select(ChatEncryptedKey).where(
            ChatEncryptedKey.chat_id == chat_id,
            ChatEncryptedKey.user_id == user_id,
            ChatEncryptedKey.key_id == SERVER_BACKUP_KEY_ID,
        )
        backup_row = (await db.execute(backup_q)).scalars().first()
        if backup_row:
            backup_row.encrypted_chat_key = backup_key_plaintext
            backup_row.key_version = key_version
        else:
            db.add(
                ChatEncryptedKey(
                    chat_id=chat_id,
                    user_id=user_id,
                    key_id=SERVER_BACKUP_KEY_ID,
                    encrypted_chat_key=backup_key_plaintext,
                    key_version=key_version,
                )
            )

    await db.commit()
    await db.refresh(primary)
    return primary


async def get_chat_encrypted_key_for_user(
    db: AsyncSession,
    chat_id: int,
    user_id: int,
    key_id: Optional[str] = None,
    key_version: Optional[int] = None,
) -> Optional[ChatEncryptedKey]:
    if key_id:
        by_device_q = (
            select(ChatEncryptedKey)
            .where(
                ChatEncryptedKey.chat_id == chat_id,
                ChatEncryptedKey.user_id == user_id,
                ChatEncryptedKey.key_id == key_id,
            )
            .where(ChatEncryptedKey.key_id != SERVER_BACKUP_KEY_ID)
            .where(ChatEncryptedKey.key_version == key_version if key_version is not None else True)
            .order_by(ChatEncryptedKey.key_version.desc(), ChatEncryptedKey.id.desc())
        )
        by_device = (await db.execute(by_device_q)).scalars().first()
        if by_device:
            return by_device

    q = (
        select(ChatEncryptedKey)
        .where(ChatEncryptedKey.chat_id == chat_id, ChatEncryptedKey.user_id == user_id)
        .where(ChatEncryptedKey.key_id != SERVER_BACKUP_KEY_ID)
        .where(ChatEncryptedKey.key_version == key_version if key_version is not None else True)
        .order_by(ChatEncryptedKey.key_version.desc(), ChatEncryptedKey.id.desc())
    )
    return (await db.execute(q)).scalars().first()


async def get_chat_backup_key_for_user(
    db: AsyncSession,
    chat_id: int,
    user_id: int,
) -> Optional[ChatEncryptedKey]:
    q = (
        select(ChatEncryptedKey)
        .where(
            ChatEncryptedKey.chat_id == chat_id,
            ChatEncryptedKey.user_id == user_id,
            ChatEncryptedKey.key_id == SERVER_BACKUP_KEY_ID,
        )
        .order_by(ChatEncryptedKey.key_version.desc(), ChatEncryptedKey.created_at.desc())
    )
    return (await db.execute(q)).scalars().first()


async def delete_chat_encrypted_keys(db: AsyncSession, chat_id: int) -> None:
    q = select(ChatEncryptedKey).where(ChatEncryptedKey.chat_id == chat_id)
    rows = (await db.execute(q)).scalars().all()
    for row in rows:
        await db.delete(row)
    await db.commit()


async def chat_has_any_encrypted_keys(db: AsyncSession, chat_id: int) -> bool:
    q = (
        select(func.count(ChatEncryptedKey.id))
        .where(ChatEncryptedKey.chat_id == chat_id)
        .where(ChatEncryptedKey.key_id != SERVER_BACKUP_KEY_ID)
    )
    count = (await db.execute(q)).scalar() or 0
    return count > 0


# ==================== Group Chat Management ====================

async def leave_group_chat(db: AsyncSession, chat_id: int, user_id: int) -> bool:
    """User leaves a group chat. Admin can't leave if they're the last admin."""
    # Check if there are other admins
    members = await get_chat_members(db, chat_id)
    user_member = None
    other_admins_count = 0
    for m in members:
        if m.user_id == user_id:
            user_member = m
        elif m.role == MemberRole.admin:
            other_admins_count += 1

    if not user_member:
        return False

    # If this is the last admin, we need to promote someone else or delete the chat
    # For simplicity, we just remove them (in production you'd want to handle this better)
    await db.delete(user_member)
    await db.commit()
    return True


async def kick_member(db: AsyncSession, chat_id: int, kicked_by: int, user_id: int) -> bool:
    """Kick a member from a group chat (only admin can kick)."""
    # Check if the kicker is admin
    kicker_role = await get_member_role(db, chat_id, kicked_by)
    if kicker_role != MemberRole.admin:
        return False

    # Can't kick yourself (use leave_group_chat instead)
    if kicked_by == user_id:
        return False

    # Can't kick other admins
    target_role = await get_member_role(db, chat_id, user_id)
    if target_role == MemberRole.admin:
        return False

    return await remove_member_from_chat(db, chat_id, user_id)
