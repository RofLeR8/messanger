import secrets
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
from app.config import get_auth_data
from typing import Optional


VERIFICATION_TOKEN_EXPIRE_MINUTES = 30
TOKEN_TYPE = "email_verification"


def create_verification_token(user_id: int, email: str) -> tuple[str, str]:
    jti = secrets.token_urlsafe(16)
    auth_data = get_auth_data()

    expire = datetime.now(timezone.utc) + timedelta(minutes=VERIFICATION_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": str(user_id),
        "email": email,
        "type": TOKEN_TYPE,
        "jti": jti,
        "exp": expire,
    }

    token = jwt.encode(payload, auth_data["secret_key"], algorithm=auth_data["algorithm"])
    return token, jti


def decode_verification_token(token: str) -> Optional[dict]:
    auth_data = get_auth_data()
    try:
        payload = jwt.decode(
            token,
            auth_data["secret_key"],
            algorithms=[auth_data["algorithm"]],
            options={"verify_type": True},
        )

        if payload.get("type") != TOKEN_TYPE:
            return None

        return payload
    except JWTError:
        return None


def get_verification_expire_minutes() -> int:
    return VERIFICATION_TOKEN_EXPIRE_MINUTES
