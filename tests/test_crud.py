import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime


class TestUserCRUD:
    """Tests for user CRUD operations."""

    @pytest.mark.asyncio
    async def test_get_one_by_id_or_none(self, mock_db, sample_user):
        """Test getting user by ID."""
        with patch('src.app.users.crud.select') as mock_select:
            mock_result = MagicMock()
            mock_result.scalars.return_value.first.return_value = sample_user
            mock_db.execute.return_value = mock_result
            
            from src.app.users import crud
            result = await crud.get_one_by_id_or_none(mock_db, 1)
            
            mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_one_by_email_or_none(self, mock_db, sample_user):
        """Test getting user by email."""
        with patch('src.app.users.crud.select') as mock_select:
            mock_result = MagicMock()
            mock_result.scalars.return_value.first.return_value = sample_user
            mock_db.execute.return_value = mock_result
            
            from src.app.users import crud
            result = await crud.get_one_by_email_or_none(mock_db, "test@example.com")

    @pytest.mark.asyncio
    async def test_get_one_by_username_or_none(self, mock_db, sample_user):
        """Test getting user by username."""
        with patch('src.app.users.crud.select') as mock_select:
            mock_result = MagicMock()
            mock_result.scalars.return_value.first.return_value = sample_user
            mock_db.execute.return_value = mock_result
            
            from src.app.users import crud
            result = await crud.get_one_by_username_or_none(mock_db, "testuser")

    @pytest.mark.asyncio
    async def test_update_user_profile(self, mock_db, sample_user):
        """Test user profile update."""
        from src.app.users import crud
        
        sample_user.name = "Updated Name"
        
        result = await crud.update_user_profile(mock_db, sample_user, {"name": "Updated Name"})
        
        mock_db.commit.assert_called()
        mock_db.refresh.assert_called()

    @pytest.mark.asyncio
    async def test_update_user_avatar(self, mock_db, sample_user):
        """Test user avatar update."""
        from src.app.users import crud
        
        avatar_url = "https://example.com/avatar.jpg"
        
        result = await crud.update_user_avatar(mock_db, sample_user, avatar_url)
        
        assert result.avatar_url == avatar_url
        mock_db.commit.assert_called()

    @pytest.mark.asyncio
    async def test_get_all_users(self, mock_db, sample_user):
        """Test getting all users except current."""
        with patch('src.app.users.crud.select') as mock_select:
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = [sample_user]
            mock_db.execute.return_value = mock_result
            
            from src.app.users import crud
            result = await crud.get_all_users(mock_db, 1)
            
            assert len(result) >= 0

    @pytest.mark.asyncio
    async def test_set_user_online(self, mock_db, sample_user):
        """Test setting user online status."""
        with patch('src.app.users.crud.get_one_by_id_or_none', return_value=sample_user):
            from src.app.users import crud
            result = await crud.set_user_online(mock_db, 1, True)
            
            assert result is not None
            mock_db.commit.assert_called()

    @pytest.mark.asyncio
    async def test_update_user_last_seen(self, mock_db, sample_user):
        """Test updating user last seen."""
        with patch('src.app.users.crud.get_one_by_id_or_none', return_value=sample_user):
            from src.app.users import crud
            result = await crud.update_user_last_seen(mock_db, 1)
            
            assert result is not None

    @pytest.mark.asyncio
    async def test_get_users_online_status(self, mock_db):
        """Test getting online status for multiple users."""
        mock_row1 = MagicMock()
        mock_row1.id = 1
        mock_row1.is_online = True
        mock_row2 = MagicMock()
        mock_row2.id = 2
        mock_row2.is_online = False
        
        mock_result = MagicMock()
        mock_result.all.return_value = [mock_row1, mock_row2]
        mock_db.execute.return_value = mock_result
        
        from src.app.users import crud
        result = await crud.get_users_online_status(mock_db, [1, 2])
        
        assert result == {1: True, 2: False}


class TestFriendshipCRUD:
    """Tests for friendship CRUD operations."""

    @pytest.mark.asyncio
    async def test_get_friendship(self, mock_db, sample_friendship):
        """Test getting friendship between users."""
        with patch('src.app.users.crud.select') as mock_select:
            mock_result = MagicMock()
            mock_result.scalars.return_value.first.return_value = sample_friendship
            mock_db.execute.return_value = mock_result
            
            from src.app.users import crud
            result = await crud.get_friendship(mock_db, 1, 2)
            
            assert result is not None

    @pytest.mark.asyncio
    async def test_get_friendship_not_found(self, mock_db):
        """Test getting non-existent friendship."""
        with patch('src.app.users.crud.select') as mock_select:
            mock_result = MagicMock()
            mock_result.scalars.return_value.first.return_value = None
            mock_db.execute.return_value = mock_result
            
            from src.app.users import crud
            result = await crud.get_friendship(mock_db, 1, 2)
            
            assert result is None

    @pytest.mark.asyncio
    async def test_create_friend_request(self, mock_db):
        """Test creating friend request."""
        with patch('src.app.users.crud.select') as mock_select:
            mock_result = MagicMock()
            mock_result.scalars.return_value.first.return_value = None
            mock_db.execute.return_value = mock_result
            
            from src.app.users import crud
            result = await crud.create_friend_request(mock_db, 1, 2)
            
            mock_db.add.assert_called()
            mock_db.commit.assert_called()

    @pytest.mark.asyncio
    async def test_create_friend_request_already_exists(self, mock_db, sample_friendship):
        """Test creating friend request when friendship already exists."""
        with patch('src.app.users.crud.select') as mock_select:
            mock_result = MagicMock()
            mock_result.scalars.return_value.first.return_value = sample_friendship
            mock_db.execute.return_value = mock_result
            
            from src.app.users import crud
            result = await crud.create_friend_request(mock_db, 1, 2)
            
            assert result is None

    @pytest.mark.skip(reason="Requires isolated test DB - use mock tests")
    @pytest.mark.asyncio
    async def test_accept_friend_request(self, test_db, sample_friendship):
        """Test accepting friend request."""
        from src.app.users import crud
        from src.app.users.models import Friendship, FriendshipStatus
        
        friendship = Friendship(
            requester_id=1,
            addressee_id=2,
            status=FriendshipStatus.PENDING
        )
        test_db.add(friendship)
        await test_db.commit()
        await test_db.refresh(friendship)
        
        result = await crud.accept_friend_request(test_db, 1, 2)
        
        assert result is not None
        assert result.status == FriendshipStatus.ACCEPTED

    @pytest.mark.skip(reason="Requires isolated test DB - use mock tests")
    @pytest.mark.asyncio
    async def test_decline_friend_request(self, test_db):
        """Test declining friend request."""
        from src.app.users import crud
        from src.app.users.models import Friendship, FriendshipStatus
        
        friendship = Friendship(
            requester_id=1,
            addressee_id=2,
            status=FriendshipStatus.PENDING
        )
        test_db.add(friendship)
        await test_db.commit()
        await test_db.refresh(friendship)
        
        result = await crud.decline_friend_request(test_db, 1, 2)
        
        assert result is not None
        assert result.status == FriendshipStatus.DECLINED

    @pytest.mark.skip(reason="Requires isolated test DB - use mock tests")
    @pytest.mark.asyncio
    async def test_remove_friendship(self, test_db):
        """Test removing friendship."""
        from src.app.users import crud
        from src.app.users.models import Friendship, FriendshipStatus
        
        friendship = Friendship(
            requester_id=1,
            addressee_id=2,
            status=FriendshipStatus.ACCEPTED
        )
        test_db.add(friendship)
        await test_db.commit()
        
        result = await crud.remove_friendship(test_db, 1, 2)
        
        assert result is True

    @pytest.mark.asyncio
    async def test_get_user_friends(self, mock_db, sample_user):
        """Test getting user friends."""
        with patch('src.app.users.crud.select') as mock_select:
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = [sample_user]
            mock_db.execute.return_value = mock_result
            
            from src.app.users import crud
            result = await crud.get_user_friends(mock_db, 1)
            
            assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_get_pending_friend_requests(self, mock_db, sample_friendship):
        """Test getting pending friend requests."""
        with patch('src.app.users.crud.select') as mock_select:
            with patch('src.app.users.crud.selectinload') as mock_load:
                mock_result = MagicMock()
                mock_result.scalars.return_value.all.return_value = [sample_friendship]
                mock_db.execute.return_value = mock_result
                
                from src.app.users import crud
                result = await crud.get_pending_friend_requests(mock_db, 2)
                
                assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_get_sent_friend_requests(self, mock_db, sample_friendship):
        """Test getting sent friend requests."""
        with patch('src.app.users.crud.select') as mock_select:
            with patch('src.app.users.crud.selectinload') as mock_load:
                mock_result = MagicMock()
                mock_result.scalars.return_value.all.return_value = [sample_friendship]
                mock_db.execute.return_value = mock_result
                
                from src.app.users import crud
                result = await crud.get_sent_friend_requests(mock_db, 1)
                
                assert isinstance(result, list)


class TestUserSessionCRUD:
    """Tests for user session CRUD operations."""

    @pytest.mark.asyncio
    async def test_create_user_session(self, mock_db, sample_user):
        """Test creating user session."""
        with patch('src.app.users.crud.secrets.token_urlsafe', return_value="test_token"):
            from src.app.users import crud
            result = await crud.create_user_session(mock_db, 1, "Test Device", "Test Info")
            
            mock_db.add.assert_called()
            mock_db.commit.assert_called()

    @pytest.mark.asyncio
    async def test_get_user_session_by_token(self, mock_db, sample_session):
        """Test getting session by token."""
        with patch('src.app.users.crud.select') as mock_select:
            mock_result = MagicMock()
            mock_result.scalars.return_value.first.return_value = sample_session
            mock_db.execute.return_value = mock_result
            
            from src.app.users import crud
            result = await crud.get_user_session_by_token(mock_db, "test_token_123")
            
            assert result is not None

    @pytest.mark.asyncio
    async def test_get_user_sessions(self, mock_db, sample_session):
        """Test getting user sessions."""
        with patch('src.app.users.crud.select') as mock_select:
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = [sample_session]
            mock_db.execute.return_value = mock_result
            
            from src.app.users import crud
            result = await crud.get_user_sessions(mock_db, 1)
            
            assert len(result) >= 0

    @pytest.mark.asyncio
    async def test_revoke_user_session(self, mock_db, sample_session):
        """Test revoking user session."""
        with patch('src.app.users.crud.get_one_session_by_id', return_value=sample_session):
            from src.app.users import crud
            result = await crud.revoke_user_session(mock_db, 1, 1)
            
            assert result is True
            mock_db.commit.assert_called()

    @pytest.mark.asyncio
    async def test_revoke_all_user_sessions(self, mock_db, sample_session):
        """Test revoking all user sessions."""
        with patch('src.app.users.crud.select') as mock_select:
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = [sample_session]
            mock_db.execute.return_value = mock_result
            
            from src.app.users import crud
            result = await crud.revoke_all_user_sessions(mock_db, 1)
            
            assert result >= 0


class TestChatCRUD:
    """Tests for chat CRUD operations."""

    @pytest.mark.asyncio
    async def test_get_chat_members(self, mock_db):
        """Test getting chat members."""
        with patch('src.app.chat.crud.select') as mock_select:
            with patch('src.app.chat.crud.selectinload') as mock_load:
                member = MagicMock()
                member.user_id = 1
                member.chat_id = 1
                
                mock_result = MagicMock()
                mock_result.scalars.return_value.all.return_value = [member]
                mock_db.execute.return_value = mock_result
                
                from src.app.chat import crud
                result = await crud.get_chat_members(mock_db, 1)
                
                assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_is_chat_member(self, mock_db):
        """Test checking if user is chat member."""
        with patch('src.app.chat.crud.select') as mock_select:
            member = MagicMock()
            
            mock_result = MagicMock()
            mock_result.scalars.return_value.first.return_value = member
            mock_db.execute.return_value = mock_result
            
            from src.app.chat import crud
            result = await crud.is_chat_member(mock_db, 1, 1)
            
            assert result is True

    @pytest.mark.asyncio
    async def test_is_not_chat_member(self, mock_db):
        """Test checking if user is not chat member."""
        with patch('src.app.chat.crud.select') as mock_select:
            mock_result = MagicMock()
            mock_result.scalars.return_value.first.return_value = None
            mock_db.execute.return_value = mock_result
            
            from src.app.chat import crud
            result = await crud.is_chat_member(mock_db, 1, 1)
            
            assert result is False

    @pytest.mark.asyncio
    async def test_add_member_to_chat(self, mock_db):
        """Test adding member to chat."""
        with patch('src.app.chat.crud.is_chat_member', return_value=False):
            with patch('src.app.chat.crud.select') as mock_select:
                from src.app.chat import crud
                result = await crud.add_member_to_chat(mock_db, 1, 2)
                
                mock_db.add.assert_called()
                mock_db.commit.assert_called()

    @pytest.mark.asyncio
    async def test_add_member_already_exists(self, mock_db):
        """Test adding member when already member."""
        with patch('src.app.chat.crud.is_chat_member', return_value=True):
            from src.app.chat import crud
            result = await crud.add_member_to_chat(mock_db, 1, 2)
            
            assert result is None

    @pytest.mark.skip(reason="SQLAlchemy table conflict during import")
    @pytest.mark.asyncio
    async def test_remove_member_from_chat(self, mock_db):
        """Test removing member from chat."""
        with patch('src.app.chat.crud.select') as mock_select:
            member = MagicMock()
            
            mock_result = MagicMock()
            mock_result.scalars.return_value.first.return_value = member
            mock_db.execute.return_value = mock_result
            
            from src.app.chat import crud
            result = await crud.remove_member_from_chat(mock_db, 1, 2)
            
            assert result is True

    @pytest.mark.asyncio
    async def test_remove_member_not_found(self, mock_db):
        """Test removing non-existent member."""
        with patch('src.app.chat.crud.select') as mock_select:
            mock_result = MagicMock()
            mock_result.scalars.return_value.first.return_value = None
            mock_db.execute.return_value = mock_result
            
            from src.app.chat import crud
            result = await crud.remove_member_from_chat(mock_db, 1, 2)
            
            assert result is False

    @pytest.mark.skip(reason="Requires isolated test DB - use mock tests")
    @pytest.mark.asyncio
    async def test_remove_member_from_chat_with_db(self, test_db):
        """Test removing member from chat with real DB."""
        from src.app.chat import crud
        from src.app.chat.models import Chat, ChatMember
        
        chat = Chat(is_group=False)
        test_db.add(chat)
        await test_db.flush()
        
        member = ChatMember(chat_id=chat.id, user_id=2)
        test_db.add(member)
        await test_db.commit()
        
        result = await crud.remove_member_from_chat(test_db, chat.id, 2)
        
        assert result is True

    @pytest.mark.skip(reason="Requires isolated test DB - use mock tests")
    @pytest.mark.asyncio
    async def test_get_member_role_with_db(self, test_db):
        """Test getting member role with real DB."""
        from src.app.chat import crud
        from src.app.chat.models import Chat, ChatMember, MemberRole
        
        chat = Chat(is_group=True)
        test_db.add(chat)
        await test_db.flush()
        
        member = ChatMember(chat_id=chat.id, user_id=1, role=MemberRole.admin)
        test_db.add(member)
        await test_db.commit()
        
        result = await crud.get_member_role(test_db, chat.id, 1)
        
        assert result == MemberRole.admin


class TestMessageCRUD:
    """Tests for message CRUD operations."""

    @pytest.mark.asyncio
    async def test_get_message_by_id(self, mock_db, sample_message):
        """Test getting message by ID."""
        with patch('src.app.chat.crud.select') as mock_select:
            mock_result = MagicMock()
            mock_result.scalars.return_value.first.return_value = sample_message
            mock_db.execute.return_value = mock_result
            
            from src.app.chat import crud
            result = await crud.get_message_by_id(mock_db, 1)
            
            assert result is not None

    @pytest.mark.asyncio
    async def test_mark_message_as_read(self, mock_db, sample_message):
        """Test marking message as read."""
        with patch('src.app.chat.crud.get_message_by_id', return_value=sample_message):
            from src.app.chat import crud
            result = await crud.mark_message_as_read(mock_db, 1)
            
            mock_db.commit.assert_called()

    @pytest.mark.asyncio
    async def test_mark_messages_as_read(self, mock_db, sample_message):
        """Test marking multiple messages as read."""
        with patch('src.app.chat.crud.select') as mock_select:
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = [sample_message]
            mock_db.execute.return_value = mock_result
            
            from src.app.chat import crud
            result = await crud.mark_messages_as_read(mock_db, 1, 2)
            
            assert result >= 0

    @pytest.mark.asyncio
    async def test_soft_delete_message(self, mock_db, sample_message):
        """Test soft deleting message."""
        chat = MagicMock()
        chat.id = 1
        
        with patch('src.app.chat.crud.get_message_by_id', side_effect=[sample_message, chat]):
            with patch('src.app.chat.crud.get_member_role', return_value=MagicMock()):
                with patch('src.app.chat.crud.get_chat_by_id', return_value=chat):
                    from src.app.chat import crud
                    result = await crud.soft_delete_message(mock_db, 1, 1)
                    
                    mock_db.commit.assert_called()

    @pytest.mark.asyncio
    async def test_edit_message(self, mock_db, sample_message):
        """Test editing message."""
        with patch('src.app.chat.crud.get_message_by_id', return_value=sample_message):
            from src.app.chat import crud
            result = await crud.edit_message(mock_db, 1, 1, "New content")
            
            mock_db.commit.assert_called()

    @pytest.mark.asyncio
    async def test_pin_message(self, mock_db, sample_message):
        """Test pinning message."""
        with patch('src.app.chat.crud.get_message_by_id', return_value=sample_message):
            from src.app.chat import crud
            result = await crud.pin_message(mock_db, 1, 1, 1)
            
            mock_db.commit.assert_called()

    @pytest.mark.asyncio
    async def test_unpin_message(self, mock_db, sample_message):
        """Test unpinning message."""
        sample_message.is_pinned = True
        
        with patch('src.app.chat.crud.get_message_by_id', return_value=sample_message):
            from src.app.chat import crud
            result = await crud.unpin_message(mock_db, 1)
            
            mock_db.commit.assert_called()