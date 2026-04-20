from app.users.models import User, Friendship, FriendshipStatus, UserPublicKey
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import or_, and_
from app.utils.jwt import get_password_hash
from app.users.schemas import SUserRegister
from sqlalchemy.exc import SQLAlchemyError
from pydantic import EmailStr
from datetime import datetime
from typing import List, Optional


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
    db_user = User(
        name=user.name,
        email=user.email,
        hashed_password=hashed_password,
        username=user.username,
        is_online=False,
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
            user.last_seen = datetime.now()  # Use naive datetime for PostgreSQL
        await db.commit()
        await db.refresh(user)
    return user

async def update_user_last_seen(db: AsyncSession, user_id: int) -> Optional[User]:
    """Update user's last seen timestamp."""
    user = await get_one_by_id_or_none(db, user_id)
    if user:
        user.last_seen = datetime.now()  # Use naive datetime for PostgreSQL
        await db.commit()
        await db.refresh(user)
    return user

async def get_users_online_status(db: AsyncSession, user_ids: List[int]) -> dict:
    """Get online status for multiple users. Returns dict {user_id: is_online}."""
    q = select(User.id, User.is_online).where(User.id.in_(user_ids))
    result = await db.execute(q)
    return {row.id: row.is_online for row in result.all()}


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