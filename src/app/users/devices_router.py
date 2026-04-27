from fastapi import APIRouter, Depends, HTTPException, status
from app.users.dependensies import get_current_user
from app.users.crud import (
    get_user_devices,
    get_active_user_devices,
    create_user_device,
    activate_user_device,
    revoke_user_device,
    get_user_device_by_id,
    get_user_device_by_pairing_token,
    generate_pairing_token_for_device,
    get_one_by_id_or_none,
)
from app.users.models import User, DeviceStatus
from app.users.schemas import (
    SUserDeviceRegister,
    SUserDeviceRead,
    SUserDevicePairingInit,
    SUserDevicePairingConfirm,
)
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from typing import List

router = APIRouter(prefix="/users/me/devices", tags=["devices"])


@router.get("/", response_model=List[SUserDeviceRead])
async def get_my_devices(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get all devices for the current user."""
    devices = await get_user_devices(db, user.id)
    return devices


@router.get("/active", response_model=List[SUserDeviceRead])
async def get_my_active_devices(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get all active devices for the current user."""
    devices = await get_active_user_devices(db, user.id)
    return devices


@router.post("/register", response_model=SUserDeviceRead)
async def register_device(
    device_data: SUserDeviceRegister,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Register a new device for the current user.
    Device starts in PENDING status and must be activated via QR pairing.
    """
    # Check if device already exists
    existing = await get_user_device_by_id(db, device_data.device_id)
    if existing:
        if existing.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Device ID already registered to another user"
            )
        # Return existing device
        return existing
    
    # Create new device in PENDING status
    device = await create_user_device(
        db=db,
        user_id=user.id,
        device_id=device_data.device_id,
        device_name=device_data.device_name,
        device_type=device_data.device_type,
        device_public_key=device_data.device_public_key,
        algorithm=device_data.algorithm,
        status=DeviceStatus.pending.value,
    )
    return device


@router.post("/pairing/init")
async def init_device_pairing(
    pairing_data: SUserDevicePairingInit,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Initiate QR code pairing for a new device.
    Returns a pairing token that should be encoded in QR code.
    The token expires in 5 minutes.
    """
    # Find the pending device
    device = await get_user_device_by_id(db, pairing_data.device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found. Please register the device first."
        )
    
    if device.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot initiate pairing for device owned by another user"
        )
    
    if device.status != DeviceStatus.pending.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Device is already {device.status}. Only pending devices can be paired."
        )
    
    # Generate pairing token
    device = await generate_pairing_token_for_device(db, device, expires_in_minutes=5)
    
    return {
        "pairing_token": device.pairing_token,
        "expires_at": device.pairing_token_expires_at.isoformat(),
        "device_id": device.device_id,
    }


@router.post("/pairing/confirm")
async def confirm_device_pairing(
    pairing_data: SUserDevicePairingConfirm,
    db: AsyncSession = Depends(get_db),
):
    """
    Confirm device pairing using a pairing token from QR code.
    This endpoint is called by the NEW device being added.
    Does NOT require authentication - the pairing token is the authentication.
    """
    # Find the pending device with valid pairing token
    target_device = await get_user_device_by_pairing_token(db, pairing_data.pairing_token)
    if not target_device:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired pairing token"
        )
    
    # Get the user who owns this device
    user = await get_one_by_id_or_none(db, target_device.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update the device with the public key from the new device
    target_device.device_public_key = pairing_data.device_public_key
    target_device.algorithm = pairing_data.algorithm
    target_device.status = DeviceStatus.active.value
    target_device.pairing_token = None
    target_device.pairing_token_expires_at = None
    target_device.last_seen_at = target_device.created_at
    
    await db.commit()
    await db.refresh(target_device)
    
    # Create an access token for the new device
    from app.users.auth import create_access_token
    access_token = create_access_token({"sub": str(user.id)})
    
    # TODO: Trigger re-wrapping of chat keys for this user on all their other devices
    # This would notify other devices to encrypt chat keys for the new device
    
    return {
        "device": target_device,
        "access_token": access_token,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "username": user.username,
        }
    }


@router.delete("/{device_id}")
async def revoke_device(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Revoke a device (logout from that device).
    This will invalidate the device and prevent it from accessing encrypted data.
    """
    device = await get_user_device_by_id(db, device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    if device.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot revoke device owned by another user"
        )
    
    # Prevent revoking the current device
    # Note: This check assumes the current device_id is passed in headers or known context
    # In practice, you might want to allow self-revocation
    
    await revoke_user_device(db, device)
    
    # TODO: Trigger key rotation for all chats this user is in
    # This would require re-encrypting chat keys without the revoked device
    
    return {"message": "Device revoked successfully"}


@router.post("/{device_id}/refresh")
async def refresh_device(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Refresh device last seen timestamp.
    Should be called periodically by active devices.
    """
    device = await get_user_device_by_id(db, device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    if device.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot refresh device owned by another user"
        )
    
    from app.users.crud import update_device_last_seen
    device = await update_device_last_seen(db, device_id)
    
    return {"message": "Device refreshed", "last_seen_at": device.last_seen_at.isoformat() if device else None}
