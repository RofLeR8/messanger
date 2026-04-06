from app.users.models import User
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
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

async def create_user(db: AsyncSession, user: SUserRegister) -> User:
    hashed_password = get_password_hash(user.password)
    db_user = User(
        name=user.name,
        email=user.email,
        hashed_password=hashed_password,
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