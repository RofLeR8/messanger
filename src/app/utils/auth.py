from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import EmailStr
from app.users.crud import get_one_by_email_or_none
from app.utils.jwt import verify_password


async def authenticate_user(db:AsyncSession, email: EmailStr, password: str):
    user = await get_one_by_email_or_none(db=db, email=email)
    if not user or verify_password(plain_password=password, hashed_password=user.hashed_password) is False:
        return None
    return user