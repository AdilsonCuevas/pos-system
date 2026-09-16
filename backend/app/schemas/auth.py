# User & Auth Schemas

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


# Auth
class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str = Field(..., min_length=2, max_length=255)
    business_type: str = Field(..., pattern='^(grocery|restaurant)$')


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: 'UserResponse'


# User
class UserBase(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=255)
    role: str = Field(default='cashier', pattern='^(admin|manager|cashier)$')
    business_type: str = Field(..., pattern='^(grocery|restaurant)$')
    max_concurrent_sessions: int = Field(default=3, ge=1, le=10)
    is_active: bool = True


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    role: Optional[str] = Field(None, pattern='^(admin|manager|cashier)$')
    business_type: Optional[str] = Field(None, pattern='^(grocery|restaurant)$')
    max_concurrent_sessions: Optional[int] = Field(None, ge=1, le=10)
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class MeResponse(BaseModel):
    user: UserResponse
    permissions: List[str]