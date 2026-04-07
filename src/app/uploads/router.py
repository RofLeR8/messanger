from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from app.users.dependensies import get_current_user
from app.users.models import User
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
import uuid
from datetime import datetime
from pathlib import Path

router = APIRouter(prefix="/uploads", tags=["uploads"])

# Upload directory
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Allowed file types
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_FILE_TYPES = ALLOWED_IMAGE_TYPES | {"application/pdf", "text/plain", "application/zip", "application/x-zip-compressed"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/file")
async def upload_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Upload a file and return the file URL."""

    # Validate file type
    if file.content_type not in ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file.content_type} not allowed. Allowed types: {', '.join(ALLOWED_FILE_TYPES)}"
        )

    # Read file content to check size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Max size: {MAX_FILE_SIZE // (1024*1024)}MB"
        )

    # Generate unique filename
    file_extension = Path(file.filename).suffix if file.filename else ""
    unique_filename = f"{uuid.uuid4().hex}{file_extension}"

    # Create subdirectory by date
    date_dir = datetime.now().strftime("%Y/%m/%d")
    upload_path = UPLOAD_DIR / date_dir
    upload_path.mkdir(parents=True, exist_ok=True)

    # Save file
    file_path = upload_path / unique_filename
    with open(file_path, "wb") as f:
        f.write(content)

    # Generate URL — note: served from /uploads/files/ prefix
    file_url = f"/uploads/files/{date_dir}/{unique_filename}"

    # Determine file type category
    file_type = "image" if file.content_type.startswith("image/") else "file"

    return {
        "file_url": file_url,
        "file_name": file.filename or unique_filename,
        "file_type": file_type,
        "content_type": file.content_type,
        "size": len(content)
    }
