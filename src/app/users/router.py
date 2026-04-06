from fastapi import APIRouter, Response, Depends
from app.users.schemas import SUserRegister, SUserAuth
from app.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.users.crud import get_one_by_email_or_none, create_user
from app.users.exceptions import UserAlreadyExistsException, PasswordMismatchException, IncorrectEmailOrPasswordException
from app.utils.jwt import get_password_hash
from app.utils.auth import authenticate_user
from app.users.auth import create_access_token
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
    
    await create_user(db,user_data)
    return {"message": "Successful registration"}


@router.post("/login/")
async def auth_user(response: Response, user_data: SUserAuth, db: AsyncSession = Depends(get_db)):
    check = await authenticate_user(db,user_data.email, user_data.password)
    if check is None:
        raise IncorrectEmailOrPasswordException
    access_token = create_access_token({"sub":str(check.id)})
    response.set_cookie(key="user_access_token", value=access_token, httponly=True)
    return {"ok": True, "access_token": access_token, "refresh_token": None, "message": "Authorization succesfull"}

@router.post("/logout/")
async def logout_user(response: Response):
    response.delete_cookie(key="user_access_token")
    return {"message": "successful logout"}
