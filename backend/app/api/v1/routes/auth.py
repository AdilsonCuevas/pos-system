# Authentication Routes

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr, Field
from datetime import timedelta
import hashlib

from app.database import get_db
from app.models.user import User
from app.utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    validate_nit,
)
from app.api.v1.routes.deps import get_current_user, require_role

router = APIRouter()


# -------------------------------------------------------------------------
# Schemas
# -------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str = Field(..., min_length=2, max_length=255)
    business_type: str = Field(..., pattern="^(grocery|restaurant)$")


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "UserResponse"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str
    business_type: str
    is_active: bool


class MeResponse(BaseModel):
    user: UserResponse
    permissions: list[str]


# -------------------------------------------------------------------------
# Helper: Get user permissions
# -------------------------------------------------------------------------

def get_user_permissions(role: str, business_type: str) -> list[str]:
    """Return permission list based on role and business type."""
    base_permissions = {
        "admin": [
            "users:read", "users:write", "users:delete",
            "roles:read", "roles:write",
            "products:read", "products:write", "products:delete",
            "categories:read", "categories:write", "categories:delete",
            "sales:read", "sales:write", "sales:refund", "sales:void",
            "reports:read", "reports:export",
            "inventory:read", "inventory:write", "inventory:adjust",
            "settings:read", "settings:write",
            "fde:read", "fde:write", "fde:config",
        ],
        "manager": [
            "users:read",
            "products:read", "products:write",
            "categories:read", "categories:write",
            "sales:read", "sales:write", "sales:refund",
            "reports:read",
            "inventory:read", "inventory:write", "inventory:adjust",
            "settings:read",
            "fde:read", "fde:write",
        ],
        "cashier": [
            "products:read",
            "sales:read", "sales:write",
            "reports:read:own",
            "inventory:read",
        ],
    }
    
    perms = base_permissions.get(role, [])
    
    # Restaurant-specific permissions
    if business_type == "restaurant":
        restaurant_perms = {
            "admin": ["ingredients:read", "ingredients:write", "ingredients:delete",
                      "recipes:read", "recipes:write", "recipes:delete",
                      "modifiers:read", "modifiers:write", "modifiers:delete"],
            "manager": ["ingredients:read", "ingredients:write",
                        "recipes:read", "recipes:write",
                        "modifiers:read", "modifiers:write"],
            "cashier": [],
        }
        perms.extend(restaurant_perms.get(role, []))
    
    return perms


# -------------------------------------------------------------------------
# Routes
# -------------------------------------------------------------------------

@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Login with email and password."""
    # Find user
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )
    
    if not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )
    
    # Create tokens
    access_token = create_access_token(
        subject=str(user.id),
        role=user.role,
        business_type=user.business_type,
    )
    refresh_token, refresh_token_hash = create_refresh_token(str(user.id))
    
    # Store refresh token hash
    from app.models.user import RefreshToken
    from datetime import datetime, timezone, timedelta
    
    # Revoke old tokens if exceeding max sessions
    user_tokens = await db.execute(
        select(RefreshToken)
        .where(RefreshToken.user_id == user.id)
        .where(RefreshToken.revoked_at.is_(None))
        .order_by(RefreshToken.created_at.desc())
    )
    active_tokens = user_tokens.scalars().all()
    
    if len(active_tokens) >= user.max_concurrent_sessions:
        # Revoke oldest
        oldest = active_tokens[-1]
        oldest.revoked_at = datetime.now(timezone.utc)
    
    new_token = RefreshToken(
        user_id=user.id,
        token_hash=refresh_token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(new_token)
    await db.commit()
    
    # Set refresh token in httpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=7 * 24 * 60 * 60,  # 7 days
        path="/api/auth/refresh",
    )
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=15 * 60,  # 15 minutes
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            business_type=user.business_type,
            is_active=user.is_active,
        ),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: RefreshRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Refresh access token using refresh token."""
    from app.models.user import RefreshToken
    from datetime import datetime, timezone
    
    # Hash the provided token
    token_hash = hashlib.sha256(request.refresh_token.encode()).hexdigest()
    
    # Find token
    result = await db.execute(
        select(RefreshToken)
        .where(RefreshToken.token_hash == token_hash)
        .where(RefreshToken.revoked_at.is_(None))
        .where(RefreshToken.expires_at > datetime.now(timezone.utc))
    )
    stored_token = result.scalar_one_or_none()
    
    if not stored_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de actualización inválido o expirado",
        )
    
    # Check for token reuse (rotation chain)
    if stored_token.replaced_by_token_hash:
        # This token was already used - revoke all user tokens (security)
        await db.execute(
            RefreshToken.__table__.update()
            .where(RefreshToken.user_id == stored_token.user_id)
            .where(RefreshToken.revoked_at.is_(None))
            .values(revoked_at=datetime.now(timezone.utc))
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token reutilizado - sesión revocada por seguridad",
        )
    
    # Get user
    user_result = await db.execute(select(User).where(User.id == stored_token.user_id))
    user = user_result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o inactivo",
        )
    
    # Create new access token
    access_token = create_access_token(
        subject=str(user.id),
        role=user.role,
        business_type=user.business_type,
    )
    
    # Create new refresh token (rotation)
    new_refresh_token, new_refresh_hash = create_refresh_token(str(user.id))
    
    # Mark old token as replaced
    stored_token.revoked_at = datetime.now(timezone.utc)
    stored_token.replaced_by_token_hash = new_refresh_hash
    
    # Store new token
    new_token = RefreshToken(
        user_id=user.id,
        token_hash=new_refresh_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(new_token)
    await db.commit()
    
    # Update cookie
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=7 * 24 * 60 * 60,
        path="/api/auth/refresh",
    )
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=15 * 60,
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            business_type=user.business_type,
            is_active=user.is_active,
        ),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Register first admin user (only if no users exist)."""
    # Check if any user exists
    existing = await db.execute(select(User).limit(1))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El registro solo está permitido para el primer administrador",
        )
    
    # Validate business type
    if request.business_type not in ["grocery", "restaurant"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tipo de negocio debe ser 'grocery' o 'restaurant'",
        )
    
    # Create admin user
    user = User(
        email=request.email,
        password_hash=hash_password(request.password),
        name=request.name,
        role="admin",
        business_type=request.business_type,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Login automatically
    return await login(LoginRequest(email=request.email, password=request.password), response, db)


@router.get("/me", response_model=MeResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """Get current user info and permissions."""
    permissions = get_user_permissions(current_user.role, current_user.business_type)
    
    return MeResponse(
        user=UserResponse(
            id=current_user.id,
            email=current_user.email,
            name=current_user.name,
            role=current_user.role,
            business_type=current_user.business_type,
            is_active=current_user.is_active,
        ),
        permissions=permissions,
    )


@router.post("/logout")
async def logout(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Logout - revoke current refresh token."""
    from app.models.user import RefreshToken
    from datetime import datetime, timezone
    import hashlib
    
    # Get refresh token from cookie
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
        await db.execute(
            RefreshToken.__table__.update()
            .where(RefreshToken.token_hash == token_hash)
            .where(RefreshToken.user_id == current_user.id)
            .values(revoked_at=datetime.now(timezone.utc))
        )
        await db.commit()
    
    # Clear cookie
    response.delete_cookie(key="refresh_token", path="/api/auth/refresh")
    
    return {"message": "Sesión cerrada correctamente"}


@router.post("/revoke-all-sessions", dependencies=[Depends(require_role("admin"))])
async def revoke_all_sessions(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Admin: Revoke all sessions for a user."""
    from app.models.user import RefreshToken
    from datetime import datetime, timezone
    
    await db.execute(
        RefreshToken.__table__.update()
        .where(RefreshToken.user_id == user_id)
        .where(RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )
    await db.commit()
    
    return {"message": f"Todas las sesiones del usuario {user_id} han sido revocadas"}