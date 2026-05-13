from fastapi import APIRouter, Response, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from app.users.schemas import SUserRegister, SUserAuth, SUserSessionRead, SResendVerification
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
    verify_user_email,
    update_verification_token,
    get_one_by_verification_jti,
)
from app.users.exceptions import IncorrectEmailOrPasswordException
from app.utils.auth import authenticate_user
from app.users.auth import create_access_token, decode_account_key_to_base64
from app.config import settings
from app.users.dependensies import get_current_user
from app.users.models import User
from app.users.verification import create_verification_token, decode_verification_token
from app.utils.email import send_verification_email
from app.utils.rate_limit import rate_limiter, get_client_ip

router = APIRouter(prefix="/auth", tags=["Auth"])


def rate_limit_response(retry_after: int):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please try again later."},
        headers={"Retry-After": str(retry_after)},
    )


@router.get("/")
async def auth_page():
    return {"message": "Auth endpoint. Use /auth/login/ or /auth/register/"}


@router.post("/register/")
async def register_user(user_data: SUserRegister, request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    client_ip = get_client_ip(request)

    allowed, retry_after = rate_limiter.check(
        f"register:{client_ip}",
        settings.REGISTER_RATE_LIMIT,
        settings.REGISTER_RATE_WINDOW,
    )
    if not allowed:
        return rate_limit_response(retry_after)

    user = await get_one_by_email_or_none(db=db, email=user_data.email)
    if user:
        return {"message": "Registration successful. Please check your email to verify your account."}

    if user_data.password != user_data.password_check:
        return {"message": "Registration successful. Please check your email to verify your account."}

    verification_token, verification_jti = create_verification_token(
        user_id=0,
        email=user_data.email,
    )
    await create_user(db, user_data, verification_token, verification_jti)

    user_record = await get_one_by_email_or_none(db=db, email=user_data.email)
    if user_record:
        user_email = user_record.email
        user_id = user_record.id
        verification_token, verification_jti = create_verification_token(
            user_id=user_id,
            email=user_email,
        )
        user_record.verification_token = verification_token
        user_record.verification_jti = verification_jti
        await db.commit()
        await db.refresh(user_record)
        await send_verification_email(user_email, verification_token)

    return {"message": "Registration successful. Please check your email to verify your account."}


@router.post("/verify-email/")
async def verify_email(request: Request, token: str, db: AsyncSession = Depends(get_db)):
    client_ip = get_client_ip(request)

    allowed, retry_after = rate_limiter.check(
        f"verify:{client_ip}",
        settings.VERIFY_RATE_LIMIT,
        settings.VERIFY_RATE_WINDOW,
    )
    if not allowed:
        return rate_limit_response(retry_after)

    payload = decode_verification_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )

    user = await get_one_by_verification_jti(db=db, jti=payload["jti"])
    if not user or not user.verification_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )

    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified"
        )

    await verify_user_email(db, user)

    return {"message": "Email verified successfully. You can now login."}


@router.post("/resend-verification/")
async def resend_verification(request: Request, data: SResendVerification, db: AsyncSession = Depends(get_db)):
    allowed, retry_after = rate_limiter.check(
        f"resend:{data.email}",
        settings.RESEND_RATE_LIMIT,
        settings.RESEND_RATE_WINDOW,
    )
    if not allowed:
        return rate_limit_response(retry_after)

    user = await get_one_by_email_or_none(db=db, email=data.email)
    if not user or user.is_verified:
        return {"message": "If an unverified account exists, a verification email has been sent."}

    verification_token, verification_jti = create_verification_token(
        user_id=user.id,
        email=user.email,
    )
    await update_verification_token(db, user, verification_token, verification_jti)
    await send_verification_email(user.email, verification_token)

    return {"message": "Verification email sent. Please check your inbox."}


@router.post("/login/")
async def auth_user(response: Response, user_data: SUserAuth, db: AsyncSession = Depends(get_db)):
    check = await authenticate_user(db, user_data.email, user_data.password)
    if check is None:
        raise IncorrectEmailOrPasswordException

    if not check.is_verified:
        return {
            "ok": False,
            "unverified": True,
            "email": user_data.email,
            "message": "Please verify your email before logging in."
        }

    user_id = check.id
    account_key_nonce = check.account_key_nonce
    account_key_salt = check.account_key_salt

    account_key = await decrypt_account_key(check, user_data.password)
    account_key_base64 = decode_account_key_to_base64(account_key) if account_key else None

    session = await create_user_session(
        db=db,
        user_id=user_id,
        device_name=user_data.device_name,
        device_info=user_data.device_info,
    )

    access_token = create_access_token({"sub": str(user_id)}, session_token=session.session_token)
    response.set_cookie(
        key="user_access_token",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
    )

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
    response.delete_cookie(
        key="user_access_token",
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
    )
    return {"message": "successful logout"}


@router.get("/sessions/", response_model=list[SUserSessionRead])
async def get_user_sessions_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_user_sessions(db=db, user_id=current_user.id)


@router.delete("/sessions/{session_id}")
async def revoke_session_endpoint(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    revoked = await revoke_user_session(db=db, session_id=session_id, user_id=current_user.id)
    if not revoked:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return {"ok": True, "message": "Session revoked"}


@router.post("/sessions/revoke-all")
async def revoke_all_sessions_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    revoked_count = await revoke_all_user_sessions(db=db, user_id=current_user.id)
    return {"ok": True, "revoked_count": revoked_count}
