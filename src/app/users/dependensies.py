from fastapi import Request, HTTPException, status, Depends
from jose import jwt, JWTError
from datetime import datetime, timezone
from app.config import get_auth_data
from app.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.users.crud import get_one_by_id_or_none


def get_token(request: Request) -> str:
    token = request.cookies.get('user_access_token')
    if not token:
        auth = request.headers.get("Authorization") or ""
        if auth.startswith("Bearer "):
            token = auth[7:].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return token


async def get_current_user(request: Request, token: str = Depends(get_token), db: AsyncSession = Depends(get_db)):
    unauthorized_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
    )

    try:
        auth_data = get_auth_data()
        payload = jwt.decode(token, auth_data['secret_key'], algorithms=auth_data['algorithm'])
    except JWTError:
        raise unauthorized_exc

    expire = payload.get('exp')
    if not expire:
        raise unauthorized_exc

    expire_time = datetime.fromtimestamp(int(expire), tz=timezone.utc)
    if expire_time < datetime.now(timezone.utc):
        raise unauthorized_exc

    user_id: str = payload.get('sub')
    if not user_id:
        raise unauthorized_exc

    user = await get_one_by_id_or_none(db, int(user_id))
    if not user:
        raise unauthorized_exc

    return user
