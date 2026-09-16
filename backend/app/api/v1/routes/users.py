# Users Routes

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import List, Optional

from app.database import get_db
from app.models.user import User, RefreshToken
from app.schemas.auth import UserCreate, UserUpdate, UserResponse
from app.schemas.auth import hash_password, verify_password
from app.api.v1.routes.deps import get_current_user, require_permission, require_role, PaginationParams

router = APIRouter()


@router.get("/", response_model=List[UserResponse])
async def list_users(
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(require_permission("users:read")),
    db: AsyncSession = Depends(get_db),
):
    """List users with filters."""
    query = select(User)
    
    if search:
        query = query.where(
            or_(
                User.email.ilike(f"%{search}%"),
                User.name.ilike(f"%{search}%"),
            )
        )
    if role:
        query = query.where(User.role == role)
    if is_active is not None:
        query = query.where(User.is_active == is_active)
    
    # Role-based filtering: users can only see users of their business type
    if current_user.role != 'admin':
        query = query.where(User.business_type == current_user.business_type)
    
    query = query.order_by(User.created_at.desc()).offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(query)
    users = result.scalars().all()
    
    return users


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create new user (admin only)."""
    # Check if email exists
    existing = await db.execute(select(User).where(User.email == user_data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email ya registrado")
    
    user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        name=user_data.name,
        role=user_data.role,
        business_type=user_data.business_type,
        max_concurrent_sessions=user_data.max_concurrent_sessions,
        is_active=user_data.is_active,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(require_permission("users:read")),
    db: AsyncSession = Depends(get_db),
):
    """Get single user."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Non-admin users can only view users of same business type
    if current_user.role != 'admin' and user.business_type != current_user.business_type:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: User = Depends(require_permission("users:write")),
    db: AsyncSession = Depends(get_db),
):
    """Update user."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Permission checks
    if current_user.role != 'admin':
        if user.business_type != current_user.business_type:
            raise HTTPException(status_code=403, detail="No autorizado")
        # Non-admin can't change roles
        if user_data.role and user_data.role != user.role:
            raise HTTPException(status_code=403, detail="No puede cambiar roles")
        # Non-admin can't change business_type
        if user_data.business_type and user_data.business_type != user.business_type:
            raise HTTPException(status_code=403, detail="No puede cambiar tipo de negocio")
    
    # Check email uniqueness if changed
    if user_data.email and user_data.email != user.email:
        existing = await db.execute(select(User).where(User.email == user_data.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email ya registrado")
    
    for field, value in user_data.model_dump(exclude_unset=True).items():
        if field == 'password':
            setattr(user, 'password_hash', hash_password(value))
        else:
            setattr(user, field, value)
    
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Delete user (admin only)."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="No puede eliminarse a sí mismo")
    
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Soft delete - deactivate
    user.is_active = False
    await db.commit()


@router.post("/{user_id}/revoke-sessions", status_code=200)
async def revoke_user_sessions(
    user_id: int,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Revoke all sessions for a user (admin only)."""
    from datetime import datetime, timezone
    
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    await db.execute(
        RefreshToken.__table__.update()
        .where(RefreshToken.user_id == user_id)
        .where(RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )
    await db.commit()
    
    return {"message": f"Todas las sesiones del usuario {user_id} han sido revocadas"}