# Modifiers Routes

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import List, Optional

from app.database import get_db
from app.models.restaurant import ModifierGroup, Modifier, ProductModifier
from app.models.catalog import Product
from app.schemas.restaurant import (
    ModifierGroupCreate, ModifierGroupUpdate, ModifierGroupResponse,
    ModifierCreate, ModifierResponse,
)
from app.api.v1.routes.deps import get_current_user, require_permission, require_business_type, PaginationParams
from app.models.user import User

router = APIRouter()


# Modifier Groups
@router.get("/groups", response_model=List[ModifierGroupResponse])
async def list_modifier_groups(
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(require_business_type("restaurant")),
    db: AsyncSession = Depends(get_db),
):
    """List modifier groups with modifiers."""
    query = select(ModifierGroup).options(selectinload(ModifierGroup.modifiers))
    
    if search:
        query = query.where(ModifierGroup.name.ilike(f"%{search}%"))
    if is_active is not None:
        query = query.where(ModifierGroup.is_active == is_active)
    
    query = query.order_by(ModifierGroup.sort_order, ModifierGroup.name).offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(query)
    groups = result.scalars().all()
    
    return groups


@router.post("/groups", response_model=ModifierGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_modifier_group(
    group_data: ModifierGroupCreate,
    current_user: User = Depends(require_permission("modifiers:write")),
    db: AsyncSession = Depends(get_db),
):
    """Create modifier group with modifiers."""
    group = ModifierGroup(
        name=group_data.name,
        selection_type=group_data.selection_type,
        required=group_data.required,
        min_selections=group_data.min_selections,
        max_selections=group_data.max_selections,
        sort_order=group_data.sort_order,
    )
    db.add(group)
    await db.flush()
    
    for idx, mod_data in enumerate(group_data.modifiers):
        modifier = Modifier(
            group_id=group.id,
            name=mod_data.name,
            price_delta=mod_data.price_delta,
            ingredient_id=mod_data.ingredient_id,
            ingredient_quantity=mod_data.ingredient_quantity,
            is_default=mod_data.is_default,
            sort_order=idx,
        )
        db.add(modifier)
    
    await db.commit()
    await db.refresh(group)
    return group


@router.get("/groups/{group_id}", response_model=ModifierGroupResponse)
async def get_modifier_group(
    group_id: int,
    current_user: User = Depends(require_business_type("restaurant")),
    db: AsyncSession = Depends(get_db),
):
    """Get single modifier group with modifiers."""
    result = await db.execute(
        select(ModifierGroup).options(selectinload(ModifierGroup.modifiers)).where(ModifierGroup.id == group_id)
    )
    group = result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(status_code=404, detail="Grupo de modificadores no encontrado")
    
    return group


@router.put("/groups/{group_id}", response_model=ModifierGroupResponse)
async def update_modifier_group(
    group_id: int,
    group_data: ModifierGroupUpdate,
    current_user: User = Depends(require_permission("modifiers:write")),
    db: AsyncSession = Depends(get_db),
):
    """Update modifier group and its modifiers."""
    result = await db.execute(
        select(ModifierGroup).options(selectinload(ModifierGroup.modifiers)).where(ModifierGroup.id == group_id)
    )
    group = result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    
    # Update group fields
    for field, value in group_data.model_dump(exclude_unset=True, exclude={'modifiers'}).items():
        setattr(group, field, value)
    
    # Replace modifiers if provided
    if group_data.modifiers is not None:
        # Delete existing
        from sqlalchemy import delete
        from app.models.restaurant import Modifier
        await db.execute(delete(Modifier).where(Modifier.group_id == group_id))
        
        # Create new
        for idx, mod_data in enumerate(group_data.modifiers):
            modifier = Modifier(
                group_id=group.id,
                name=mod_data.name,
                price_delta=mod_data.price_delta,
                ingredient_id=mod_data.ingredient_id,
                ingredient_quantity=mod_data.ingredient_quantity,
                is_default=mod_data.is_default,
                sort_order=idx,
            )
            db.add(modifier)
    
    await db.commit()
    await db.refresh(group)
    return group


@router.delete("/groups/{group_id}", status_code=204)
async def delete_modifier_group(
    group_id: int,
    current_user: User = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Delete modifier group."""
    group = await db.get(ModifierGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    
    # Check if assigned to any product
    from app.models.restaurant import ProductModifier
    usage = await db.execute(select(ProductModifier).where(ProductModifier.group_id == group_id).limit(1))
    if usage.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Grupo asignado a productos, desasigne primero")
    
    await db.delete(group)
    await db.commit()


# Product-Modifier Assignments
@router.post("/products/{product_id}/modifiers")
async def assign_modifiers_to_product(
    product_id: int,
    group_ids: List[int],
    current_user: User = Depends(require_permission("modifiers:write")),
    db: AsyncSession = Depends(get_db),
):
    """Assign modifier groups to a product."""
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    # Verify groups exist
    for gid in group_ids:
        group = await db.get(ModifierGroup, gid)
        if not group:
            raise HTTPException(status_code=400, detail=f"Grupo {gid} no encontrado")
    
    # Replace assignments
    from sqlalchemy import delete
    await db.execute(delete(ProductModifier).where(ProductModifier.product_id == product_id))
    
    for gid in group_ids:
        assignment = ProductModifier(product_id=product_id, group_id=gid)
        db.add(assignment)
    
    await db.commit()
    return {"message": "Modificadores asignados correctamente"}


@router.delete("/products/{product_id}/modifiers/{group_id}", status_code=204)
async def remove_modifier_from_product(
    product_id: int,
    group_id: int,
    current_user: User = Depends(require_permission("modifiers:write")),
    db: AsyncSession = Depends(get_db),
):
    """Remove modifier group from product."""
    from sqlalchemy import delete
    await db.execute(
        delete(ProductModifier).where(
            ProductModifier.product_id == product_id,
            ProductModifier.group_id == group_id
        )
    )
    await db.commit()