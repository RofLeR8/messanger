from fastapi import APIRouter, Response, Depends, HTTPException, status
from app.users.schemas import SUserRegister, SUserAuth, SUserSessionRead
from app.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.users.crud import (
    get_one_by_email_or_none, 
    create_user,
    create_user_session,
    get_user_sessions,
    revoke_user_session,
    revoke_all_user_sessions,
    decrypt_account_key,
)
from app.users.exceptions import UserAlreadyExistsException, PasswordMismatchException, IncorrectEmailOrPasswordException
from app.utils.jwt import get_password_hash
from app.utils.auth import authenticate_user
from app.users.auth import create_access_token, decode_account_key_to_base64
import base64

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.get("/")
async def auth_page():
    """Auth page endpoint."""
    return {"message": "Auth endpoint. Use /auth/login/ or /auth/register/"}

@router.post("/register/")
async def register_user(user_data: SUserRegister, db: AsyncSession = Depends(get_db)) -> dict:
    user = await get_one_by_email_or_none(db=db, email=user_data.email)
    if user:
        raise UserAlreadyExistsException
    if user_data.password != user_data.password_check:
        raise PasswordMismatchException("password doesn`t match")
    
    get_password_hash(user_data.password)
    
    await create_user(db, user_data)
    return {"message": "Successful registration"}


@router.post("/login/")
async def auth_user(response: Response, user_data: SUserAuth, db: AsyncSession = Depends(get_db)):
    check = await authenticate_user(db, user_data.email, user_data.password)
    if check is None:
        raise IncorrectEmailOrPasswordException
    
    user_id = check.id
    account_key_nonce = check.account_key_nonce
    account_key_salt = check.account_key_salt

    # Decrypt account key for multi-device sync before any DB commit
    account_key = await decrypt_account_key(check, user_data.password)
    account_key_base64 = decode_account_key_to_base64(account_key) if account_key else None

    # Create a new session for this device
    session = await create_user_session(
        db=db,
        user_id=user_id,
        device_name=user_data.device_name,
        device_info=user_data.device_info,
    )

    access_token = create_access_token({"sub": str(user_id)}, session_token=session.session_token)
    response.set_cookie(key="user_access_token", value=access_token, httponly=True)
    
    return {
        "ok": True,
        "access_token": access_token,
        "refresh_token": None,
        "message": "Authorization successful",
        "account_key": account_key_base64,
        "account_key_nonce": account_key_nonce,
        "account_key_salt": account_key_salt,
        "session_id": session.id,
    }

@router.post("/logout/")
async def logout_user(response: Response):
    response.delete_cookie(key="user_access_token")
    return {"message": "successful logout"}


@router.get("/sessions/", response_model=list[SUserSessionRead])
async def get_user_sessions_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(lambda: None),  # TODO: Add proper auth dependency
):
    """Get all active sessions for the current user."""
    # TODO: Replace with actual current_user from auth dependency
    # For now, this is a placeholder
    raise HTTPException(status_code=501, detail="Not implemented - requires auth dependency")


@router.delete("/sessions/{session_id}")
async def revoke_session_endpoint(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(lambda: None),  # TODO: Add proper auth dependency
):
    """Revoke a specific session."""
    # TODO: Replace with actual current_user from auth dependency
    raise HTTPException(status_code=501, detail="Not implemented - requires auth dependency")


@router.post("/sessions/revoke-all")
async def revoke_all_sessions_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(lambda: None),  # TODO: Add proper auth dependency
):
    """Revoke all sessions for the current user (force logout everywhere)."""
    # TODO: Replace with actual current_user from auth dependency
    raise HTTPException(status_code=501, detail="Not implemented - requires auth dependency")
