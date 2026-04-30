from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket.manager import manager
from app.users.crud import set_user_online, get_one_by_id_or_none, get_user_session_by_token
from app.database import async_session_maker
from jose import jwt
from datetime import datetime, timezone
from app.config import get_auth_data
import asyncio

router = APIRouter(prefix="/ws", tags=["WebSocket"])


@router.websocket("/notifications")
async def notifications_websocket(
    websocket: WebSocket,
):
    """WebSocket endpoint for real-time notifications (unread counts, online status, etc.)."""
    # Get token from query param
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
        session_token = payload.get("session_token")
        if not session_token:
            await websocket.close(code=4001, reason="Invalid token payload")
            return

        db = async_session_maker()
        try:
            user_session = await get_user_session_by_token(db, session_token)
            if not user_session or user_session.user_id != current_user_id:
                await websocket.close(code=4001, reason="Invalid session")
                return
        finally:
            await db.close()

    except Exception:
        await websocket.close(code=4001, reason="Authentication failed")
        return

    # Set user online when notification WS connects
    db = async_session_maker()
    try:
        user = await get_one_by_id_or_none(db, current_user_id)
        if user:
            await set_user_online(db, current_user_id, True)
            await db.commit()
    except Exception:
        pass

    # Connect to notifications
    await manager.connect_notification(websocket, current_user_id)

    try:
        while True:
            await asyncio.sleep(60)
    except WebSocketDisconnect:
        pass
    except asyncio.CancelledError:
        raise
    except Exception:
        pass
    finally:
        # Set user offline only if they have no other active chat connections
        try:
            if not manager.active_connections.get(current_user_id):
                await set_user_online(db, current_user_id, False)
                await db.commit()
        except Exception:
            pass
        try:
            await manager.broadcast_user_status(current_user_id, False)
        except Exception:
            pass
        manager.disconnect_notification(current_user_id)
        try:
            await db.close()
        except Exception:
            pass
