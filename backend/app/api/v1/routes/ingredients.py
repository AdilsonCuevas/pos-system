# Ingredients Routes

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import List, Optional

from app.database import get_db
from app.models.restaurant import Ingredient
from app.schemas.restaurant import IngredientCreate, IngredientUpdate, IngredientResponse, IngredientAdjustment
from app.api.v1.routes.deps import get_current_user, require_permission, require_business_type, PaginationParams
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[IngredientResponse])
async def list_ingredients(
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    low_stock_only: bool = Query(False),
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(require_business_type("restaurant")),
    db: AsyncSession = Depends(get_db),
):
    """List ingredients (restaurant only)."""
    query = select(Ingredient).where(Ingredient.is_active == True if is_active is None else is_active)
    
    if search:
        query = query.where(
            or_(
                Ingredient.name.ilike(f"%{search}%"),
            )
        )
    
    if low_stock_only:
        query = query.where(Ingredient.current_stock <= Ingredient.min_stock).where(Ingredient.min_stock > 0)
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0
    
    query = query.order_by(Ingredient.name).offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(query)
    ingredients = result.scalars().all()
    
    return ingredients


@router.post("/", response_model=IngredientResponse, status_code=status.HTTP_201_CREATED)
async def create_ingredient(
    ingredient_data: IngredientCreate,
    current_user: User = Depends(require_permission("ingredients:write")),
    db: AsyncSession = Depends(get_db),
):
    """Create new ingredient."""
    ingredient = Ingredient(**ingredient_data.model_dump())
    db.add(ingredient)
    await db.commit()
    await db.refresh(ingredient)
    return ingredient


@router.get("/{ingredient_id}", response_model=IngredientResponse)
async def get_ingredient(
    ingredient_id: int,
    current_user: User = Depends(require_business_type("restaurant")),
    db: AsyncSession = Depends(get_db),
):
    """Get single ingredient."""
    ingredient = await db.get(Ingredient, ingredient_id)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingrediente no encontrado")
    return ingredient


@router.put("/{ingredient_id}", response_model=IngredientResponse)
async def update_ingredient(
    ingredient_id: int,
    ingredient_data: IngredientUpdate,
    current_user: User = Depends(require_permission("ingredients:write")),
    db: AsyncSession = Depends(get_db),
):
    """Update ingredient."""
    ingredient = await db.get(Ingredient, ingredient_id)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingrediente no encontrado")
    
    for field, value in ingredient_data.model_dump(exclude_unset=True).items():
        setattr(ingredient, field, value)
    
    await db.commit()
    await db.refresh(ingredient)
    return ingredient


@router.delete("/{ingredient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ingredient(
    ingredient_id: int,
    current_user: User = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Delete ingredient (soft delete if used in recipes)."""
    ingredient = await db.get(Ingredient, ingredient_id)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingrediente no encontrado")
    
    # Check if used in any recipe
    from app.models.restaurant import RecipeIngredient
    from sqlalchemy import select
    from app.database import get_db
    
    usage = await db.execute(
        select(RecipeIngredient).where(RecipeIngredient.ingredient_id == ingredient_id).limit(1)
    )
    if usage.scalar_one_or_none():
        ingredient.is_active = False
    else:
        await db.delete(ingredient)
    
    await db.commit()


@router.post("/{ingredient_id}/adjust", response_model=IngredientResponse)
async def adjust_ingredient_stock(
    ingredient_id: int,
    adjustment: IngredientAdjustment,
    current_user: User = Depends(require_permission("inventory:adjust")),
    db: AsyncSession = Depends(get_db),
):
    """Adjust ingredient stock (entry/exit/adjustment)."""
    ingredient = await db.get(Ingredient, ingredient_id)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingrediente no encontrado")
    
    if adjustment.type == 'entry':
        ingredient.current_stock += adjustment.quantity
    elif adjustment.type == 'exit':
        if ingredient.current_stock < adjustment.quantity:
            raise HTTPException(status_code=400, detail=f"Stock insuficiente: disponible {ingredient.current_stock}, solicitado {adjustment.quantity}")
        ingredient.current_stock -= adjustment.quantity
    elif adjustment.type == 'adjustment':
        ingredient.current_stock = adjustment.quantity
    
    # Record movement
    from app.models.inventory import InventoryMovement
    from datetime import datetime, timezone
    
    movement = InventoryMovement(
        type=adjustment.type,
        reference_type='ingredient',
        reference_id=ingredient_id,
        quantity=adjustment.quantity if adjustment.type == 'entry' else -adjustment.quantity,
        unit_cost=adjustment.unit_cost,
        reason=adjustment.reason,
        reference=adjustment.reference,
        user_id=current_user.id,
        notes=adjustment.notes,
        created_at=datetime.now(timezone.utc),
    )
    db.add(movement)
    
    await db.commit()
    await db.refresh(ingredient)
    return ingredient