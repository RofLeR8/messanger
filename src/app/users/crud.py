from app.users.models import User, Friendship, FriendshipStatus, UserPublicKey, UserSession
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import or_, and_
from app.utils.jwt import get_password_hash
from app.users.schemas import SUserRegister
from sqlalchemy.exc import SQLAlchemyError
from pydantic import EmailStr
from datetime import datetime, timedelta
from typing import List, Optional
import secrets
import hashlib
import os


# Users CRUD
async def get_one_by_id_or_none(db: AsyncSession, id: int) -> Optional[User]:
    q = select(User).where(User.id == id)
    result = await db.execute(q)
    return result.scalars().first()

async def get_one_by_email_or_none(db: AsyncSession, email: EmailStr) -> Optional[User]:
    q = select(User).filter(User.email == email)
    result = await db.execute(q)
    return result.scalars().first()

async def get_one_by_username_or_none(db: AsyncSession, username: str) -> Optional[User]:
    q = select(User).filter(User.username == username)
    result = await db.execute(q)
    return result.scalars().first()

async def create_user(db: AsyncSession, user: SUserRegister) -> User:
    hashed_password = get_password_hash(user.password)
    
    # Generate account encryption key if not provided
    account_key_cipher = None
    account_key_nonce = None
    account_key_salt = None
    
    if user.account_key_cipher and user.account_key_nonce and user.account_key_salt:
        # Client provided encrypted account key (multi-device setup)
        account_key_cipher = user.account_key_cipher.encode() if isinstance(user.account_key_cipher, str) else user.account_key_cipher
        account_key_nonce = user.account_key_nonce
        account_key_salt = user.account_key_salt
    else:
        # Generate new account key for first-time registration
        # Generate a random 256-bit key for chat encryption
        account_key = os.urandom(32)
        # Derive key from password using PBKDF2
        account_key_salt = secrets.token_hex(16)
        password_key = hashlib.pbkdf2_hmac('sha256', user.password.encode(), account_key_salt.encode(), 100000, 32)
        # XOR the account key with password-derived key (simple encryption)
        account_key_cipher = bytes(a ^ b for a, b in zip(account_key, password_key))
        account_key_nonce = secrets.token_hex(12)
    
    db_user = User(
        name=user.name,
        email=user.email,
        hashed_password=hashed_password,
        username=user.username,
        is_online=False,
        # Store account encryption key if provided (for multi-device sync)
        account_key_cipher=account_key_cipher,
        account_key_nonce=account_key_nonce,
        account_key_salt=account_key_salt,
    )
    db.add(db_user)
    try:
        await db.commit()
        await db.refresh(db_user)
    except SQLAlchemyError as e:
        await db.rollback()
        raise e
    return db_user

async def update_user_profile(db: AsyncSession, user: User, profile_data: dict) -> User:
    """Update user profile fields."""
    for key, value in profile_data.items():
        if hasattr(user, key):
            setattr(user, key, value)
    try:
        await db.commit()
        await db.refresh(user)
    except SQLAlchemyError as e:
        await db.rollback()
        raise e
    return user

async def update_user_avatar(db: AsyncSession, user: User, avatar_url: Optional[str]) -> User:
    """Update user avatar URL."""
    user.avatar_url = avatar_url
    try:
        await db.commit()
        await db.refresh(user)
    except SQLAlchemyError as e:
        await db.rollback()
        raise e
    return user

async def get_all_users(db: AsyncSession, user_id: int) -> List[User]:
    q = select(User).where(User.id != user_id)
    result = await db.execute(q)
    return result.scalars().all()

async def set_user_online(db: AsyncSession, user_id: int, is_online: bool) -> Optional[User]:
    """Set user's online status."""
    user = await get_one_by_id_or_none(db, user_id)
    if user:
        user.is_online = is_online
        if not is_online:
            user.last_seen = datetime.utcnow()  # Use UTC time
        await db.commit()
        await db.refresh(user)
    return user

async def update_user_last_seen(db: AsyncSession, user_id: int) -> Optional[User]:
    """Update user's last seen timestamp."""
    user = await get_one_by_id_or_none(db, user_id)
    if user:
        user.last_seen = datetime.utcnow()  # Use UTC time
        await db.commit()
        await db.refresh(user)
    return user

async def get_users_online_status(db: AsyncSession, user_ids: List[int]) -> dict:
    """Get online status for multiple users. Returns dict {user_id: is_online}."""
    q = select(User.id, User.is_online).where(User.id.in_(user_ids))
    result = await db.execute(q)
    return {row.id: row.is_online for row in result.all()}


async def get_all_online_users(db: AsyncSession) -> List[dict]:
    """Get all users with is_online=True."""
    q = select(User.id, User.last_seen).where(User.is_online == True)
    result = await db.execute(q)
    return [
        {"user_id": row.id, "last_seen": row.last_seen.isoformat() if row.last_seen else None}
        for row in result.all()
    ]


async def upsert_user_public_key(
    db: AsyncSession,
    user_id: int,
    key_id: str,
    algorithm: str,
    public_key: str,
) -> UserPublicKey:
    q = select(UserPublicKey).where(
        UserPublicKey.user_id == user_id,
        UserPublicKey.key_id == key_id,
    )
    existing = (await db.execute(q)).scalars().first()
    if existing:
        existing.algorithm = algorithm
        existing.public_key = public_key
        existing.revoked_at = None
        await db.commit()
        await db.refresh(existing)
        return existing

    key_row = UserPublicKey(
        user_id=user_id,
        key_id=key_id,
        algorithm=algorithm,
        public_key=public_key,
    )
    db.add(key_row)
    await db.commit()
    await db.refresh(key_row)
    return key_row


async def get_active_public_keys_for_user(db: AsyncSession, user_id: int) -> List[UserPublicKey]:
    q = (
        select(UserPublicKey)
        .where(UserPublicKey.user_id == user_id)
        .where(UserPublicKey.revoked_at.is_(None))
        .order_by(UserPublicKey.created_at.desc())
    )
    return (await db.execute(q)).scalars().all()


# Friendships CRUD
async def get_friendship(
    db: AsyncSession, requester_id: int, addressee_id: int
) -> Optional[Friendship]:
    """Get friendship between two users (checks both directions)."""
    q = select(Friendship).where(
        or_(
            and_(
                Friendship.requester_id == requester_id,
                Friendship.addressee_id == addressee_id,
            ),
            and_(
                Friendship.requester_id == addressee_id,
                Friendship.addressee_id == requester_id,
            ),
        )
    )
    result = await db.execute(q)
    return result.scalars().first()

async def create_friend_request(
    db: AsyncSession, requester_id: int, addressee_id: int
) -> Optional[Friendship]:
    """Create a friend request. Returns None if friendship already exists."""
    existing = await get_friendship(db, requester_id, addressee_id)
    if existing:
        return None

    friendship = Friendship(
        requester_id=requester_id,
        addressee_id=addressee_id,
        status=FriendshipStatus.PENDING,
    )
    db.add(friendship)
    try:
        await db.commit()
        await db.refresh(friendship)
    except SQLAlchemyError as e:
        await db.rollback()
        raise e
    return friendship

async def accept_friend_request(
    db: AsyncSession, requester_id: int, addressee_id: int
) -> Optional[Friendship]:
    """Accept a pending friend request."""
    friendship = await get_friendship(db, requester_id, addressee_id)
    if not friendship or friendship.status != FriendshipStatus.PENDING:
        return None

    # Ensure the current user is the addressee
    if friendship.addressee_id != addressee_id:
        # Swap: current user was requester, now accepting
        friendship.requester_id = addressee_id
        friendship.addressee_id = requester_id

    friendship.status = FriendshipStatus.ACCEPTED
    try:
        await db.commit()
        await db.refresh(friendship)
    except SQLAlchemyError as e:
        await db.rollback()
        raise e
    return friendship

async def decline_friend_request(
    db: AsyncSession, requester_id: int, addressee_id: int
) -> Optional[Friendship]:
    """Decline a pending friend request."""
    friendship = await get_friendship(db, requester_id, addressee_id)
    if not friendship or friendship.status != FriendshipStatus.PENDING:
        return None

    friendship.status = FriendshipStatus.DECLINED
    try:
        await db.commit()
        await db.refresh(friendship)
    except SQLAlchemyError as e:
        await db.rollback()
        raise e
    return friendship

async def remove_friendship(
    db: AsyncSession, requester_id: int, addressee_id: int
) -> bool:
    """Remove friendship completely."""
    friendship = await get_friendship(db, requester_id, addressee_id)
    if not friendship:
        return False

    try:
        await db.delete(friendship)
        await db.commit()
        return True
    except SQLAlchemyError as e:
        await db.rollback()
        raise e

async def get_user_friends(db: AsyncSession, user_id: int) -> List[User]:
    """Get list of accepted friends for a user."""
    q = (
        select(User)
        .join(
            Friendship,
            or_(
                and_(
                    Friendship.requester_id == user_id,
                    Friendship.addressee_id == User.id,
                ),
                and_(
                    Friendship.addressee_id == user_id,
                    Friendship.requester_id == User.id,
                ),
            ),
        )
        .where(
            Friendship.status == FriendshipStatus.ACCEPTED,
            User.id != user_id,
        )
    )
    result = await db.execute(q)
    return result.scalars().all()

async def get_pending_friend_requests(
    db: AsyncSession, user_id: int
) -> List[Friendship]:
    """Get pending friend requests received by user."""
    q = (
        select(Friendship)
        .where(
            Friendship.addressee_id == user_id,
            Friendship.status == FriendshipStatus.PENDING,
        )
    )
    q = q.options(selectinload(Friendship.requester))
    result = await db.execute(q)
    return result.scalars().all()

async def get_sent_friend_requests(
    db: AsyncSession, user_id: int
) -> List[Friendship]:
    """Get pending friend requests sent by user."""
    q = (
        select(Friendship)
        .where(
            Friendship.requester_id == user_id,
            Friendship.status == FriendshipStatus.PENDING,
        )
    )
    q = q.options(selectinload(Friendship.addressee))
    result = await db.execute(q)
    return result.scalars().all()


# UserSession CRUD
async def create_user_session(
    db: AsyncSession,
    user_id: int,
    device_name: Optional[str] = None,
    device_info: Optional[str] = None,
    expires_in_days: int = 30,
) -> UserSession:
    """Create a new session for a user."""
    session_token = secrets.token_urlsafe(64)
    expires_at = datetime.now() + timedelta(days=expires_in_days)
    
    session = UserSession(
        user_id=user_id,
        session_token=session_token,
        device_name=device_name,
        device_info=device_info,
        expires_at=expires_at,
        is_revoked=False,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def get_user_session_by_token(
    db: AsyncSession, session_token: str
) -> Optional[UserSession]:
    """Get a session by its token."""
    q = select(UserSession).where(
        UserSession.session_token == session_token,
        UserSession.is_revoked == False,
    )
    result = await db.execute(q)
    return result.scalars().first()


async def get_user_sessions(
    db: AsyncSession, user_id: int
) -> List[UserSession]:
    """Get all active sessions for a user."""
    q = select(UserSession).where(
        UserSession.user_id == user_id,
        UserSession.is_revoked == False,
    ).order_by(UserSession.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()


async def revoke_user_session(
    db: AsyncSession, session_id: int, user_id: int
) -> bool:
    """Revoke a specific session."""
    session = await get_one_session_by_id(db, session_id)
    if not session or session.user_id != user_id:
        return False
    
    session.is_revoked = True
    await db.commit()
    return True


async def revoke_all_user_sessions(
    db: AsyncSession, user_id: int
) -> int:
    """Revoke all sessions for a user. Returns count of revoked sessions."""
    q = select(UserSession).where(
        UserSession.user_id == user_id,
        UserSession.is_revoked == False,
    )
    result = await db.execute(q)
    sessions = result.scalars().all()
    
    for session in sessions:
        session.is_revoked = True
    
    await db.commit()
    return len(sessions)


async def update_session_last_active(
    db: AsyncSession, session_token: str
) -> Optional[UserSession]:
    """Update the last_active_at timestamp for a session."""
    session = await get_user_session_by_token(db, session_token)
    if session:
        session.last_active_at = datetime.now()
        await db.commit()
        await db.refresh(session)
    return session


async def get_one_session_by_id(
    db: AsyncSession, session_id: int
) -> Optional[UserSession]:
    """Get a session by ID."""
    q = select(UserSession).where(UserSession.id == session_id)
    result = await db.execute(q)
    return result.scalars().first()


async def cleanup_expired_sessions(db: AsyncSession) -> int:
    """Remove expired sessions. Returns count of deleted sessions."""
    q = select(UserSession).where(
        UserSession.expires_at < datetime.now(),
    )
    result = await db.execute(q)
    expired_sessions = result.scalars().all()
    
    for session in expired_sessions:
        await db.delete(session)
    
    await db.commit()
    return len(expired_sessions)


async def decrypt_account_key(
    user: User, password: str
) -> Optional[bytes]:
    """Decrypt the account encryption key using the user's password."""
    if not user.account_key_cipher or not user.account_key_salt:
        return None
    
    # Derive key from password
    password_key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode(),
        user.account_key_salt.encode(),
        100000,
        32
    )
    
    # XOR to decrypt
    account_key = bytes(a ^ b for a, b in zip(user.account_key_cipher, password_key))
    return account_key