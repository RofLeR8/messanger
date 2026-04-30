from jose import jwt
from datetime import datetime, timedelta, timezone
from app.config import get_auth_data
import base64


def create_access_token(data: dict, session_token: str = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=5)
    to_encode["exp"] = expire
    if session_token:
        to_encode["session_token"] = session_token
    auth_data = get_auth_data()
    encode_jwt = jwt.encode(to_encode, auth_data['secret_key'], algorithm=auth_data['algorithm'])
    return encode_jwt


def decode_account_key_to_base64(account_key_bytes: bytes) -> str:
    """Convert account key bytes to base64 string for client."""
    return base64.b64encode(account_key_bytes).decode('ascii')