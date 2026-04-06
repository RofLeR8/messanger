from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional

class SUserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., max_length=30, min_length=5)
    password_check: str = Field(..., max_length=30, min_length=5)
    name: str = Field(..., max_length=30)

class SUserAuth(BaseModel):
    email: EmailStr = Field(..., description="Email")
    password: str = Field(..., max_length=30, min_length=5)

class SUserRead(BaseModel):
    id: int
    email: str
    name: str
    is_online: bool = False
    last_seen: Optional[datetime] = None
    
    class Config:
        from_attributes = True
