from fastapi import APIRouter, Depends, HTTPException
from app.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.users.crud import (
    get_all_users,
    get_one_by_id_or_none,
    get_one_by_username_or_none,
    update_user_profile,
    update_user_avatar,
    create_friend_request,
    accept_friend_request,
    decline_friend_request,
    remove_friendship,
    get_user_friends,
    get_pending_friend_requests,
    get_sent_friend_requests,
    get_friendship,
    upsert_user_public_key,
    get_active_public_keys_for_user,
)
from app.users.schemas import (
    SUserProfile,
    SUserProfileUpdate,
    SFriendRequest,
    SUserPublicKeyCreate,
    SUserPublicKeyRead,
)
from app.users.dependensies import get_current_user
from app.users.models import User, FriendshipStatus
from app.websocket.manager import manager

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/", response_model=list[SUserProfile])
async def list_users(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    """Get all users except current user with online status."""
    users = await get_all_users(db, user.id)

    result = []
    for u in users:
        result.append({
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "username": u.username,
            "phone": u.phone,
            "bio": u.bio,
            "avatar_url": u.avatar_url,
            "is_online": manager.is_user_online(u.id),
            "last_seen": u.last_seen.isoformat() if u.last_seen else None,
        })

    return result


@router.get("/me", response_model=SUserProfile)
async def get_current_user_info(user: User = Depends(get_current_user)):
    """Get current user info."""
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "username": user.username,
        "phone": user.phone,
        "bio": user.bio,
        "avatar_url": user.avatar_url,
        "is_online": manager.is_user_online(user.id),
        "last_seen": user.last_seen.isoformat() if user.last_seen else None,
    }


@router.patch("/me", response_model=SUserProfile)
async def update_current_user_profile(
    profile_data: SUserProfileUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update current user profile fields."""
    update_dict = profile_data.model_dump(exclude_unset=True)
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")

    updated_user = await update_user_profile(db, user, update_dict)
    return {
        "id": updated_user.id,
        "email": updated_user.email,
        "name": updated_user.name,
        "username": updated_user.username,
        "phone": updated_user.phone,
        "bio": updated_user.bio,
        "avatar_url": updated_user.avatar_url,
        "is_online": manager.is_user_online(updated_user.id),
        "last_seen": updated_user.last_seen.isoformat() if updated_user.last_seen else None,
    }


@router.patch("/me/avatar", response_model=SUserProfile)
async def update_current_user_avatar(
    avatar_url: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update current user avatar URL. Pass empty string to remove avatar."""
    new_avatar = avatar_url if avatar_url else None
    updated_user = await update_user_avatar(db, user, new_avatar)
    return {
        "id": updated_user.id,
        "email": updated_user.email,
        "name": updated_user.name,
        "username": updated_user.username,
        "phone": updated_user.phone,
        "bio": updated_user.bio,
        "avatar_url": updated_user.avatar_url,
        "is_online": manager.is_user_online(updated_user.id),
        "last_seen": updated_user.last_seen.isoformat() if updated_user.last_seen else None,
    }


@router.post("/me/keys", response_model=SUserPublicKeyRead)
async def register_my_public_key(
    key_data: SUserPublicKeyCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    key_row = await upsert_user_public_key(
        db=db,
        user_id=user.id,
        key_id=key_data.key_id,
        algorithm=key_data.algorithm,
        public_key=key_data.public_key,
    )
    return key_row


@router.get("/{user_id}/keys", response_model=list[SUserPublicKeyRead])
async def list_user_public_keys(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_user = await get_one_by_id_or_none(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    return await get_active_public_keys_for_user(db, user_id)


@router.get("/search/{username}", response_model=SUserProfile)
async def get_user_by_username(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search user by username."""
    target_user = await get_one_by_username_or_none(db, username)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": target_user.id,
        "email": target_user.email,
        "name": target_user.name,
        "username": target_user.username,
        "phone": target_user.phone,
        "bio": target_user.bio,
        "avatar_url": target_user.avatar_url,
        "is_online": manager.is_user_online(target_user.id),
        "last_seen": target_user.last_seen.isoformat() if target_user.last_seen else None,
    }


@router.get("/{user_id}", response_model=SUserProfile)
async def get_user_info(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get user info by ID with online status."""
    target_user = await get_one_by_id_or_none(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": target_user.id,
        "email": target_user.email,
        "name": target_user.name,
        "username": target_user.username,
        "phone": target_user.phone,
        "bio": target_user.bio,
        "avatar_url": target_user.avatar_url,
        "is_online": manager.is_user_online(target_user.id),
        "last_seen": target_user.last_seen.isoformat() if target_user.last_seen else None,
    }


# Friends routes — /me/* MUST come before /{user_id}/* to avoid "me" being parsed as int
@router.get("/me/friends")
async def get_my_friends(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get current user's friends list."""
    friends = await get_user_friends(db, user.id)
    result = []
    for friend in friends:
        result.append({
            "id": friend.id,
            "user_id": friend.id,
            "name": friend.name,
            "username": friend.username,
            "avatar_url": friend.avatar_url,
            "is_online": manager.is_user_online(friend.id),
            "last_seen": friend.last_seen.isoformat() if friend.last_seen else None,
        })

    return result


@router.get("/me/friends/requests/pending", response_model=list[dict])
async def get_pending_requests(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get pending friend requests received by current user."""
    requests = await get_pending_friend_requests(db, user.id)
    result = []
    for req in requests:
        result.append({
            "id": req.id,
            "requester_id": req.requester_id,
            "requester_name": req.requester.name,
            "requester_username": req.requester.username,
            "requester_avatar": req.requester.avatar_url,
            "status": req.status.value,
        })

    return result


@router.get("/me/friends/requests/sent", response_model=list[dict])
async def get_sent_requests(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get pending friend requests sent by current user."""
    requests = await get_sent_friend_requests(db, user.id)
    result = []
    for req in requests:
        result.append({
            "id": req.id,
            "addressee_id": req.addressee_id,
            "addressee_name": req.addressee.name,
            "addressee_username": req.addressee.username,
            "addressee_avatar": req.addressee.avatar_url,
            "status": req.status.value,
        })

    return result


@router.post("/me/friends/request")
async def send_friend_request(
    friend_data: SFriendRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Send a friend request to another user."""
    if friend_data.addressee_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot send friend request to yourself")

    target_user = await get_one_by_id_or_none(db, friend_data.addressee_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await get_friendship(db, user.id, friend_data.addressee_id)
    if existing:
        if existing.status == FriendshipStatus.PENDING:
            raise HTTPException(status_code=400, detail="Friend request already sent")
        elif existing.status == FriendshipStatus.ACCEPTED:
            raise HTTPException(status_code=400, detail="Already friends")
        elif existing.status == FriendshipStatus.DECLINED:
            # Allow re-sending after decline
            existing.requester_id = user.id
            existing.addressee_id = friend_data.addressee_id
            existing.status = FriendshipStatus.PENDING
            await db.commit()
            return {"message": "Friend request sent"}

    friendship = await create_friend_request(db, user.id, friend_data.addressee_id)
    if not friendship:
        raise HTTPException(status_code=400, detail="Friend request already exists")

    return {"message": "Friend request sent"}


@router.post("/me/friends/request/{requester_id}/accept")
async def accept_request(
    requester_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Accept a pending friend request."""
    if requester_id == user.id:
        raise HTTPException(status_code=400, detail="Invalid request")

    friendship = await accept_friend_request(db, requester_id, user.id)
    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found or already processed")

    return {"message": "Friend request accepted"}


@router.post("/me/friends/request/{requester_id}/decline")
async def decline_request(
    requester_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Decline a pending friend request."""
    if requester_id == user.id:
        raise HTTPException(status_code=400, detail="Invalid request")

    friendship = await decline_friend_request(db, requester_id, user.id)
    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found or already processed")

    return {"message": "Friend request declined"}


@router.delete("/me/friends/{friend_id}")
async def remove_friend(
    friend_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Remove a friend."""
    if friend_id == user.id:
        raise HTTPException(status_code=400, detail="Invalid request")

    success = await remove_friendship(db, user.id, friend_id)
    if not success:
        raise HTTPException(status_code=404, detail="Friendship not found")

    return {"message": "Friend removed"}


# Dynamic routes — must be AFTER /me/* routes
@router.get("/{user_id}/friends")
async def get_user_friends_list(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get list of friends for a user."""
    target_user = await get_one_by_id_or_none(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    friends = await get_user_friends(db, user_id)
    result = []
    for friend in friends:
        result.append({
            "id": friend.id,
            "user_id": friend.id,
            "name": friend.name,
            "username": friend.username,
            "avatar_url": friend.avatar_url,
            "is_online": manager.is_user_online(friend.id),
            "last_seen": friend.last_seen.isoformat() if friend.last_seen else None,
        })

    return result
