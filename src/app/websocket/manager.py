from fastapi import WebSocket
from typing import Dict, List, Set
from collections import defaultdict


class ConnectionManager:
    def __init__(self):
        # user_id -> List[WebSocket] for chat connections
        self.active_connections: Dict[int, List[WebSocket]] = defaultdict(list)
        # chat_id -> Set[user_id] - users currently in chat
        self.chat_users: Dict[int, Set[int]] = defaultdict(set)
        # user_id -> Set[chat_id] - chats user is currently in
        self.user_chats: Dict[int, Set[int]] = defaultdict(set)
        # user_id -> WebSocket for notification connection
        self.notification_connections: Dict[int, WebSocket] = {}
        # All connected users for online status
        self.online_users: Set[int] = set()

    async def connect(self, websocket: WebSocket, user_id: int, chat_id: int):
        """Accept and register a new WebSocket connection for chat."""
        await websocket.accept()
        self.active_connections[user_id].append(websocket)
        self.chat_users[chat_id].add(user_id)
        self.user_chats[user_id].add(chat_id)
        self.online_users.add(user_id)

    def disconnect(self, websocket: WebSocket, user_id: int, chat_id: int):
        """Remove a WebSocket connection for chat."""
        if websocket in self.active_connections[user_id]:
            self.active_connections[user_id].remove(websocket)

        self.chat_users[chat_id].discard(user_id)
        self.user_chats[user_id].discard(chat_id)

        # If user has no more connections, mark as offline
        if not self.active_connections[user_id]:
            self.online_users.discard(user_id)
            del self.active_connections[user_id]

    async def connect_notification(self, websocket: WebSocket, user_id: int):
        """Accept and register a new WebSocket connection for notifications."""
        await websocket.accept()
        self.notification_connections[user_id] = websocket
        self.online_users.add(user_id)

    def disconnect_notification(self, user_id: int):
        """Remove a notification WebSocket connection."""
        if user_id in self.notification_connections:
            del self.notification_connections[user_id]
        
        # If user has no more connections at all, mark as offline
        if not self.active_connections.get(user_id) and user_id not in self.notification_connections:
            self.online_users.discard(user_id)

    async def send_personal_message(self, message: dict, user_id: int):
        """Send a message to a specific user."""
        for connection in self.active_connections[user_id]:
            try:
                await connection.send_json(message)
            except Exception:
                pass

    async def send_notification(self, message: dict, user_id: int):
        """Send a notification to a specific user."""
        if user_id in self.notification_connections:
            try:
                await self.notification_connections[user_id].send_json(message)
            except Exception as e:
                print(f"Error sending notification to user {user_id}: {e}")

    async def broadcast_to_chat(
        self,
        message: dict,
        chat_id: int,
        exclude: WebSocket = None,
        exclude_user_id: int = None
    ):
        """Broadcast a message to all users in a chat (only users currently in this chat)."""
        # Get all users in this chat
        users_in_chat = self.chat_users.get(chat_id, set())

        for user_id in users_in_chat:
            if exclude_user_id and user_id == exclude_user_id:
                continue

            for connection in self.active_connections[user_id]:
                if connection != exclude:
                    try:
                        await connection.send_json(message)
                    except Exception:
                        # Connection might be closed, ignore
                        pass

    async def broadcast_read_receipt(self, message: dict, chat_id: int, exclude_user_id: int = None):
        """Broadcast read receipt to all connected users via notification channel."""
        # Send to all users with notification connections
        for user_id, connection in self.notification_connections.items():
            if exclude_user_id and user_id == exclude_user_id:
                continue
            try:
                await connection.send_json(message)
            except Exception:
                pass
        
        # Also send to users in this chat (for backward compatibility)
        users_in_chat = self.chat_users.get(chat_id, set())
        for user_id in users_in_chat:
            if exclude_user_id and user_id == exclude_user_id:
                continue
            for connection in self.active_connections.get(user_id, []):
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

    async def broadcast_user_status(self, user_id: int, is_online: bool):
        """Broadcast user's online status to all users who have chats with this user."""
        # This would require knowing which users have chats with this user
        # For now, we'll broadcast to all connected clients
        status_message = {
            "type": "user_status",
            "user_id": user_id,
            "is_online": is_online
        }

        # Send to all connections (could be optimized)
        for connections in self.active_connections.values():
            for connection in connections:
                try:
                    await connection.send_json(status_message)
                except Exception:
                    pass
        
        # Also send via notification connections
        for uid, connection in self.notification_connections.items():
            if uid != user_id:
                try:
                    await connection.send_json(status_message)
                except Exception:
                    pass

    def is_user_online(self, user_id: int) -> bool:
        """Check if a user is online."""
        return user_id in self.online_users

    def get_online_users(self) -> List[int]:
        """Get list of all online users."""
        return list(self.online_users)

    def disconnect_user_from_chat(self, user_id: int, chat_id: int):
        """Disconnect all connections of a user from a specific chat (used when kicked/left)."""
        # Remove from chat_users and user_chats tracking
        self.chat_users[chat_id].discard(user_id)
        self.user_chats[user_id].discard(chat_id)

        # If user has no more chat connections, remove from active_connections
        if not self.user_chats[user_id]:
            self.chat_users.pop(chat_id, None)


manager = ConnectionManager()
