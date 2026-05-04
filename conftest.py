import pytest
import pytest_asyncio
import asyncio
import os
import sys
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import declarative_base

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

TestBase = declarative_base()

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = None
TestSessionLocal = None


def setup_test_db():
    """Set up test database with SQLite."""
    global test_engine, TestSessionLocal
    
    test_engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
    
    TestSessionLocal = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    return test_engine, TestSessionLocal


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def test_db():
    """Create a fresh test database for each test."""
    from app.database import Base
    
    engine, SessionLocal = setup_test_db()
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with SessionLocal() as session:
        yield session
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest.fixture
def mock_db():
    """Create a mock database session for simple tests."""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.refresh = AsyncMock()
    session.add = MagicMock()
    session.delete = MagicMock()
    session.flush = AsyncMock()
    return session


@pytest.fixture
def sample_user():
    """Create a sample user for testing."""
    user = MagicMock()
    user.id = 1
    user.email = "test@example.com"
    user.name = "Test User"
    user.username = "testuser"
    user.hashed_password = "$2b$12$hashed_password"
    user.is_online = False
    user.last_seen = None
    user.account_key_cipher = b"encrypted_key"
    user.account_key_nonce = "nonce123"
    user.account_key_salt = "salt123"
    return user


@pytest.fixture
def sample_chat():
    """Create a sample chat for testing."""
    chat = MagicMock()
    chat.id = 1
    chat.name = "Test Chat"
    chat.is_group = False
    chat.created_by = 1
    chat.photo_url = None
    chat.last_message_id = None
    chat.last_message_at = None
    return chat


@pytest.fixture
def sample_message():
    """Create a sample message for testing."""
    message = MagicMock()
    message.id = 1
    message.sender_id = 1
    message.recipient_id = 2
    message.content = "Hello World"
    message.chat_id = 1
    message.is_delivered = True
    message.is_read = False
    message.is_deleted = False
    message.is_edited = False
    message.is_pinned = False
    message.created_at = None
    return message


@pytest.fixture
def sample_friendship():
    """Create a sample friendship for testing."""
    friendship = MagicMock()
    friendship.id = 1
    friendship.requester_id = 1
    friendship.addressee_id = 2
    friendship.status = "pending"
    return friendship


@pytest.fixture
def sample_session():
    """Create a sample user session for testing."""
    session = MagicMock()
    session.id = 1
    session.user_id = 1
    session.session_token = "test_token_123"
    session.device_name = "Test Device"
    session.device_info = "Test Info"
    session.is_revoked = False
    return session