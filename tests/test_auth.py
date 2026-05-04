import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta, timezone

from src.app.users.auth import create_access_token, decode_account_key_to_base64
from src.app.utils.jwt import get_password_hash, verify_password
from src.app.utils.auth import authenticate_user


class TestPasswordHashing:
    """Tests for password hashing functions."""

    def test_get_password_hash(self):
        """Test password hashing produces a valid hash."""
        password = "short"
        hashed = get_password_hash(password)

        assert hashed is not None
        assert hashed != password
        assert len(hashed) > 0

    def test_verify_password_correct(self):
        """Test password verification with correct password."""
        password = "short"
        hashed = get_password_hash(password)

        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """Test password verification with incorrect password."""
        password = "short"
        wrong_password = "wrong"
        hashed = get_password_hash(password)

        assert verify_password(wrong_password, hashed) is False


class TestJWTToken:
    """Tests for JWT token functions."""

    @patch('src.app.users.auth.get_auth_data')
    def test_create_access_token(self, mock_auth_data):
        """Test JWT token creation."""
        mock_auth_data.return_value = {'secret_key': 'test_secret', 'algorithm': 'HS256'}
        
        data = {'sub': '1', 'email': 'test@example.com'}
        token = create_access_token(data)
        
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0

    @patch('src.app.users.auth.get_auth_data')
    def test_create_access_token_with_session(self, mock_auth_data):
        """Test JWT token creation with session token."""
        mock_auth_data.return_value = {'secret_key': 'test_secret', 'algorithm': 'HS256'}
        
        data = {'sub': '1'}
        session_token = "test_session_token"
        token = create_access_token(data, session_token)
        
        assert token is not None

    def test_decode_account_key_to_base64(self):
        """Test account key base64 encoding."""
        account_key = b"test_key_data_32_bytes_long_aaaa"
        encoded = decode_account_key_to_base64(account_key)
        
        assert encoded is not None
        assert isinstance(encoded, str)
        assert len(encoded) > 0


class TestAuthenticateUser:
    """Tests for authenticate_user function."""

    @pytest.mark.asyncio
    async def test_authenticate_user_success(self, sample_user):
        """Test successful user authentication."""
        mock_db = AsyncMock()
        
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = sample_user
        mock_db.execute.return_value = mock_result
        
        with patch('src.app.utils.auth.get_one_by_email_or_none', return_value=sample_user):
            with patch('src.app.utils.auth.verify_password', return_value=True):
                result = await authenticate_user(mock_db, "test@example.com", "password")
                
                assert result is not None
                assert result.id == sample_user.id

    @pytest.mark.asyncio
    async def test_authenticate_user_wrong_password(self, sample_user):
        """Test authentication with wrong password."""
        mock_db = AsyncMock()
        
        with patch('src.app.utils.auth.get_one_by_email_or_none', return_value=sample_user):
            with patch('src.app.utils.auth.verify_password', return_value=False):
                result = await authenticate_user(mock_db, "test@example.com", "wrong_password")
                
                assert result is None

    @pytest.mark.asyncio
    async def test_authenticate_user_not_found(self):
        """Test authentication with non-existent user."""
        mock_db = AsyncMock()
        
        with patch('src.app.utils.auth.get_one_by_email_or_none', return_value=None):
            result = await authenticate_user(mock_db, "nonexistent@example.com", "password")
            
            assert result is None


class TestUserRegistration:
    """Tests for user registration."""

    @pytest.mark.asyncio
    async def test_create_user(self, mock_db, sample_user):
        """Test user creation."""
        from src.app.users.schemas import SUserRegister
        from src.app.users.crud import create_user
        
        with patch('src.app.users.crud.get_password_hash', return_value="hashed_password"):
            user_data = SUserRegister(
                email="test@example.com",
                password="password123",
                password_check="password123",
                name="Test User",
                username="testuser"
            )
            
            with patch('src.app.users.crud.os.urandom', return_value=b"key_data_32_bytes_long_aaaa"):
                with patch('src.app.users.crud.secrets.token_hex', side_effect=["nonce123", "salt123"]):
                    result = await create_user(mock_db, user_data)
                    
                    mock_db.add.assert_called_once()
                    mock_db.commit.assert_called_once()