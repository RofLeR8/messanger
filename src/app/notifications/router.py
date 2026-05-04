from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket.manager import manager
from app.users.crud import set_user_online, get_one_by_id_or_none, get_user_session_by_token, get_all_online_users
from app.database import async_session_maker
from jose import jwt
from datetime import datetime, timezone
from app.config import get_auth_data
import asyncio
import logging

logger = logging.getLogger(__name__)

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

        db_temp = async_session_maker()
        try:
            user_session = await get_user_session_by_token(db_temp, session_token)
            if not user_session or user_session.user_id != current_user_id:
                await websocket.close(code=4001, reason="Invalid session")
                return
        finally:
            await db_temp.close()

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

    # Broadcast online status to all other connected users
    try:
        await manager.broadcast_user_status(current_user_id, True)
    except Exception:
        pass

    # Send list of all online users to the newly connected client
    try:
        online_users = await get_all_online_users(db)
        await websocket.send_json({
            "type": "online_users",
            "users": online_users
        })
    except Exception:
        pass

    try:
        while True:
            # Use receive_text to detect disconnect
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=60.0)
            except asyncio.TimeoutError:
                # Timeout is normal, just continue
                continue
    except WebSocketDisconnect:
        pass
    except asyncio.CancelledError:
        raise
    except Exception:
        pass
    finally:
        # Check if user has any other connections before going offline
        has_chat_connections = bool(manager.active_connections.get(current_user_id))
        
        logger.info(f"User {current_user_id} disconnecting from notifications. Has chat connections: {has_chat_connections}")
        
        # Disconnect from notifications
        manager.disconnect_notification(current_user_id)
        
        # Set user offline only if they have no chat connections
        if not has_chat_connections:
            try:
                await set_user_online(db, current_user_id, False)
                await db.commit()
                logger.info(f"User {current_user_id} set to offline in DB")
            except Exception as e:
                logger.error(f"Error setting user {current_user_id} offline: {e}")
            try:
                await manager.broadcast_user_status(current_user_id, False)
                logger.info(f"Broadcasted offline status for user {current_user_id}")
            except Exception as e:
                logger.error(f"Error broadcasting offline status for user {current_user_id}: {e}")
        try:
            await db.close()
        except Exception:
            pass
