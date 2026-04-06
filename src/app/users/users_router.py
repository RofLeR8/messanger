from fastapi import APIRouter, Depends
from app.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.users.crud import get_all_users, get_one_by_id_or_none
from app.users.dependensies import get_current_user
from app.users.models import User
from app.websocket.manager import manager

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/")
async def list_users(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Get all users except current user with online status."""
    users = await get_all_users(db, user.id)
    
    # Get online status from WebSocket manager
    result = []
    for u in users:
        result.append({
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "is_online": manager.is_user_online(u.id),
            "last_seen": u.last_seen.isoformat() if u.last_seen else None,
        })
    
    return result

@router.get("/me")
async def get_current_user_info(user: User = Depends(get_current_user)):
    """Get current user info."""
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "is_online": manager.is_user_online(user.id),
        "last_seen": user.last_seen.isoformat() if user.last_seen else None,
    }

@router.get("/{user_id}")
async def get_user_info(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user info by ID with online status."""
    target_user = await get_one_by_id_or_none(db, user_id)
    if not target_user:
        return {"error": "User not found"}
    
    return {
        "id": target_user.id,
        "email": target_user.email,
        "name": target_user.name,
        "is_online": manager.is_user_online(target_user.id),
        "last_seen": target_user.last_seen.isoformat() if target_user.last_seen else None,
    }
