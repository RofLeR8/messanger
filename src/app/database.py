import os
from pathlib import Path
from sqlalchemy import func
from datetime import datetime

from sqlalchemy.orm import Mapped, mapped_column, DeclarativeBase
from sqlalchemy.ext.asyncio import AsyncAttrs, async_sessionmaker, create_async_engine, AsyncSession
from dotenv import load_dotenv

# Load .env.local if it exists (for local development), otherwise .env (for Docker)
_env_path = Path(__file__).resolve().parent.parent.parent / ".env.local"
if not _env_path.exists():
    _env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(_env_path)

def get_database_url() -> str:
    user = os.getenv("POSTGRES_USER", "ws-test")
    password = os.getenv("POSTGRES_PASSWORD", "ws-test")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    db = os.getenv("POSTGRES_DB", "ws-test")
    return f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{db}"

database_url = get_database_url()

engine = create_async_engine(url=database_url)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession)

class Base(AsyncAttrs, DeclarativeBase):
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


async def get_db():
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            raise e
        finally:
            await session.close()
