import os
from pydantic_settings import BaseSettings, SettingsConfigDict

def get_env_or_default(key, default=None):
    """Read env var, fallback to .env file if available."""
    value = os.environ.get(key)
    if value is not None:
        return value
    return default

class Settings(BaseSettings):
    SECRET_KEY: str
    ALGORITHM: str
    E2EE_ENABLED: bool = True
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"),
        extra="allow"
    )

settings = Settings()

def get_auth_data():
    return {"secret_key": settings.SECRET_KEY, "algorithm": settings.ALGORITHM}


def is_e2ee_enabled() -> bool:
    return bool(settings.E2EE_ENABLED)

    