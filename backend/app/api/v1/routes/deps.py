# API Dependencies - Authentication, Authorization, Database

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List

from app.database import get_db
from app.models.user import User, RefreshToken
from app.utils.security import decode_access_token, hashlib
from app.config import settings


# Security scheme
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get current authenticated user from JWT token."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        payload = decode_access_token(credentials.credentials)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check token type
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )
    
    # Get user from database
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o inactivo",
        )
    
    return user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Get current user if authenticated, otherwise None."""
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None


def require_role(*allowed_roles: str):
    """Dependency to require specific role(s)."""
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Se requiere uno de los siguientes roles: {', '.join(allowed_roles)}",
            )
        return current_user
    return role_checker


def require_permission(permission: str):
    """Dependency to require specific permission."""
    async def permission_checker(current_user: User = Depends(get_current_user)) -> User:
        # Map role to permissions
        role_permissions = {
            "admin": ["*"],
            "manager": [
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
        
        user_perms = role_permissions.get(current_user.role, [])
        
        # Add business-type specific permissions
        if current_user.business_type == "restaurant":
            restaurant_perms = {
                "admin": ["ingredients:*", "recipes:*", "modifiers:*"],
                "manager": ["ingredients:read", "ingredients:write",
                           "recipes:read", "recipes:write",
                           "modifiers:read", "modifiers:write"],
                "cashier": [],
            }
            user_perms.extend(restaurant_perms.get(current_user.role, []))
        
        # Check permission
        if "*" not in user_perms and permission not in user_perms:
            # Check wildcard
            perm_parts = permission.split(":")
            for i in range(1, len(perm_parts) + 1):
                wildcard = ":".join(perm_parts[:i]) + ":*"
                if wildcard in user_perms:
                    return current_user
            
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permiso requerido: {permission}",
            )
        
        return current_user
    return permission_checker


def require_business_type(*allowed_types: str):
    """Dependency to require specific business type."""
    async def type_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.business_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Esta función solo está disponible para: {', '.join(allowed_types)}",
            )
        return current_user
    return type_checker


# Pagination
class PaginationParams:
    def __init__(
        self,
        page: int = 1,
        page_size: int = 20,
    ):
        self.page = max(1, page)
        self.page_size = min(max(1, page_size), 100)
    
    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size
    
    @property
    def limit(self) -> int:
        return self.page_size


async def get_pagination(
    page: int = 1,
    page_size: int = 20,
) -> PaginationParams:
    return PaginationParams(page=page, page_size=page_size)


# Rate limiting (simple in-memory, use Redis in production)
_rate_limit_store = {}

async def rate_limit(
    request: Request,
    limit: int = 100,
    window: int = 60,
):
    """Simple rate limiting by IP."""
    client_ip = request.client.host
    key = f"ratelimit:{client_ip}"
    
    import time
    now = time.time()
    
    if key not in _rate_limit_store:
        _rate_limit_store[key] = []
    
    # Clean old entries
    _rate_limit_store[key] = [t for t in _rate_limit_store[key] if now - t < window]
    
    if len(_rate_limit_store[key]) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Límite de {limit} solicitudes por {window}s excedido",
        )
    
    _rate_limit_store[key].append(now)