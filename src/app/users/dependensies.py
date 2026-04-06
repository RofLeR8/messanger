from fastapi import Request, HTTPException, status, Depends, WebSocket
from fastapi.responses import RedirectResponse
from jose import jwt, JWTError
from datetime import datetime, timezone
from app.config import get_auth_data
from app.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.users.crud import get_one_by_id_or_none

def get_token(request: Request):
    token = request.cookies.get('user_access_token')
    if not token:
        return RedirectResponse(url="/")
    return token

async def get_current_user(request: Request, token: str = Depends(get_token), db: AsyncSession = Depends(get_db)):
    # Check if this is a WebSocket request
    is_websocket = isinstance(request, WebSocket)
    
    try:
        auth_data = get_auth_data()
        payload = jwt.decode(token, auth_data['secret_key'], algorithms=auth_data['algorithm'])
    except JWTError:
        if is_websocket:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        raise RedirectResponse(url="/")

    expire = payload.get('exp')
    if not expire:
        if is_websocket:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
        raise RedirectResponse(url="/")

    expire_time = datetime.fromtimestamp(int(expire), tz=timezone.utc)
    if expire_time < datetime.now(timezone.utc):
        if is_websocket:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
        raise RedirectResponse(url="/")

    user_id: str = payload.get('sub')
    if not user_id:
        if is_websocket:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user")
        raise RedirectResponse(url="/")

    user = await get_one_by_id_or_none(db, int(user_id))
    if not user:
        if is_websocket:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        raise RedirectResponse(url="/")

    return user
