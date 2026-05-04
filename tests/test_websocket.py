import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from src.app.websocket.manager import ConnectionManager


class TestConnectionManager:
    """Tests for ConnectionManager."""

    @pytest.mark.asyncio
    async def test_manager_init(self):
        """Test ConnectionManager initialization."""
        manager = ConnectionManager()
        
        assert manager.active_connections == {}
        assert manager.notification_connections == {}
        assert manager.chat_users == {}
        assert manager.user_chats == {}
        assert manager.online_users == set()

    @pytest.mark.asyncio
    async def test_connect(self):
        """Test connecting a WebSocket."""
        manager = ConnectionManager()
        mock_websocket = AsyncMock()
        
        await manager.connect(mock_websocket, 1, 1)
        
        assert 1 in manager.active_connections
        assert mock_websocket in manager.active_connections[1]
        assert 1 in manager.chat_users[1]
        assert 1 in manager.user_chats[1]
        assert 1 in manager.online_users

    @pytest.mark.asyncio
    async def test_disconnect(self):
        """Test disconnecting a WebSocket."""
        manager = ConnectionManager()
        mock_websocket = AsyncMock()
        
        await manager.connect(mock_websocket, 1, 1)
        manager.disconnect(mock_websocket, 1, 1)
        
        assert 1 not in manager.chat_users.get(1, set())

    @pytest.mark.asyncio
    async def test_connect_notification(self):
        """Test connecting a notification WebSocket."""
        manager = ConnectionManager()
        mock_websocket = AsyncMock()
        
        await manager.connect_notification(mock_websocket, 1)
        
        assert 1 in manager.notification_connections
        assert 1 in manager.online_users

    @pytest.mark.asyncio
    async def test_disconnect_notification(self):
        """Test disconnecting a notification WebSocket."""
        manager = ConnectionManager()
        mock_websocket = AsyncMock()
        
        await manager.connect_notification(mock_websocket, 1)
        manager.disconnect_notification(1)
        
        assert 1 not in manager.notification_connections

    @pytest.mark.asyncio
    async def test_is_user_online(self):
        """Test checking if user is online."""
        manager = ConnectionManager()
        
        mock_ws = AsyncMock()
        await manager.connect_notification(mock_ws, 1)
        
        assert manager.is_user_online(1) is True
        assert manager.is_user_online(999) is False

    @pytest.mark.asyncio
    async def test_get_online_users(self):
        """Test getting online users."""
        manager = ConnectionManager()
        
        mock_ws1 = AsyncMock()
        mock_ws2 = AsyncMock()
        await manager.connect_notification(mock_ws1, 1)
        await manager.connect_notification(mock_ws2, 2)
        
        online = manager.get_online_users()
        
        assert 1 in online
        assert 2 in online

    @pytest.mark.asyncio
    async def test_disconnect_user_from_chat(self):
        """Test disconnecting user from a specific chat."""
        manager = ConnectionManager()
        
        mock_ws = AsyncMock()
        await manager.connect(mock_ws, 1, 1)
        manager.disconnect_user_from_chat(1, 1)
        
        assert 1 not in manager.user_chats.get(1, set())


class TestConnectionManagerMessaging:
    """Tests for ConnectionManager messaging."""

    @pytest.mark.asyncio
    async def test_send_personal_message(self):
        """Test sending personal message."""
        manager = ConnectionManager()
        mock_ws = AsyncMock()
        
        await manager.connect(mock_ws, 1, 1)
        await manager.send_personal_message({"type": "test"}, 1)
        
        mock_ws.send_json.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_personal_message_no_user(self):
        """Test sending personal message to non-existent user."""
        manager = ConnectionManager()
        
        await manager.send_personal_message({"type": "test"}, 999)
        
        assert True

    @pytest.mark.asyncio
    async def test_send_notification(self):
        """Test sending notification."""
        manager = ConnectionManager()
        mock_ws = AsyncMock()
        
        await manager.connect_notification(mock_ws, 1)
        await manager.send_notification({"type": "notification"}, 1)
        
        mock_ws.send_json.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_notification_no_user(self):
        """Test sending notification to non-existent user."""
        manager = ConnectionManager()
        
        await manager.send_notification({"type": "notification"}, 999)
        
        assert True


class TestConnectionManagerBroadcast:
    """Tests for ConnectionManager broadcast."""

    @pytest.mark.asyncio
    async def test_broadcast_to_chat(self):
        """Test broadcasting message to chat."""
        manager = ConnectionManager()
        
        mock_ws1 = AsyncMock()
        mock_ws2 = AsyncMock()
        
        await manager.connect(mock_ws1, 1, 1)
        await manager.connect(mock_ws2, 2, 1)
        
        await manager.broadcast_to_chat({"type": "message"}, 1)
        
        mock_ws1.send_json.assert_called()
        mock_ws2.send_json.assert_called()

    @pytest.mark.asyncio
    async def test_broadcast_to_chat_exclude(self):
        """Test broadcasting with user exclusion."""
        manager = ConnectionManager()
        
        mock_ws1 = AsyncMock()
        mock_ws2 = AsyncMock()
        
        await manager.connect(mock_ws1, 1, 1)
        await manager.connect(mock_ws2, 2, 1)
        
        await manager.broadcast_to_chat({"type": "message"}, 1, exclude_user_id=1)
        
        mock_ws1.send_json.assert_not_called()
        mock_ws2.send_json.assert_called()

    @pytest.mark.asyncio
    async def test_broadcast_to_empty_chat(self):
        """Test broadcasting to empty chat."""
        manager = ConnectionManager()
        
        result = await manager.broadcast_to_chat({"type": "test"}, 999)
        
        assert result is None or result is not False

    @pytest.mark.asyncio
    async def test_broadcast_read_receipt(self):
        """Test broadcasting read receipt."""
        manager = ConnectionManager()
        
        mock_ws1 = AsyncMock()
        mock_ws2 = AsyncMock()
        
        await manager.connect_notification(mock_ws1, 1)
        await manager.connect_notification(mock_ws2, 2)
        
        await manager.broadcast_read_receipt({"type": "read"}, 1)
        
        mock_ws1.send_json.assert_called()
        mock_ws2.send_json.assert_called()

    @pytest.mark.asyncio
    async def test_broadcast_user_status(self):
        """Test broadcasting user status to other users."""
        manager = ConnectionManager()
        
        mock_ws1 = AsyncMock()
        mock_ws2 = AsyncMock()
        
        await manager.connect_notification(mock_ws1, 1)
        await manager.connect_notification(mock_ws2, 2)
        
        await manager.broadcast_user_status(1, True)
        
        mock_ws1.send_json.assert_not_called()
        mock_ws2.send_json.assert_called()
        
        call_args = mock_ws2.send_json.call_args[0][0]
        assert call_args["type"] == "user_status"
        assert call_args["user_id"] == 1
        assert call_args["is_online"] is True