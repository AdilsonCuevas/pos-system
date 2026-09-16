# Recipes Routes

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from typing import List

from app.database import get_db
from app.models.restaurant import Recipe, RecipeIngredient, Ingredient
from app.models.catalog import Product
from app.schemas.restaurant import RecipeCreate, RecipeUpdate, RecipeResponse, RecipeIngredientCreate
from app.api.v1.routes.deps import get_current_user, require_permission, require_business_type
from app.models.user import User

router = APIRouter()


@router.get("/product/{product_id}", response_model=RecipeResponse)
async def get_recipe_by_product(
    product_id: int,
    current_user: User = Depends(require_business_type("restaurant")),
    db: AsyncSession = Depends(get_db),
):
    """Get recipe for a product."""
    result = await db.execute(
        select(Recipe)
        .options(selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient))
        .where(Recipe.product_id == product_id)
    )
    recipe = result.scalar_one_or_none()
    
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada para este producto")
    
    return RecipeResponse(**recipe.__dict__, ingredients=recipe.ingredients)


@router.put("/product/{product_id}", response_model=RecipeResponse)
async def upsert_recipe(
    product_id: int,
    recipe_data: RecipeCreate,
    current_user: User = Depends(require_permission("recipes:write")),
    db: AsyncSession = Depends(get_db),
):
    """Create or update recipe for a product."""
    # Verify product exists and is composite
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if product.type != 'composite':
        raise HTTPException(status_code=400, detail="Solo productos compuestos pueden tener receta")
    
    # Check if recipe exists
    result = await db.execute(select(Recipe).where(Recipe.product_id == product_id))
    recipe = result.scalar_one_or_none()
    
    if recipe:
        # Update existing
        recipe.name = recipe_data.name
        recipe.instructions = recipe_data.instructions
        recipe.prep_time_minutes = recipe_data.prep_time_minutes
        recipe.cook_time_minutes = recipe_data.cook_time_minutes
        recipe.yield_quantity = recipe_data.yield_quantity
        recipe.yield_unit = recipe_data.yield_unit
    else:
        # Create new
        recipe = Recipe(
            product_id=product_id,
            name=recipe_data.name,
            instructions=recipe_data.instructions,
            prep_time_minutes=recipe_data.prep_time_minutes,
            cook_time_minutes=recipe_data.cook_time_minutes,
            yield_quantity=recipe_data.yield_quantity,
            yield_unit=recipe_data.yield_unit,
        )
        db.add(recipe)
        await db.flush()
    
    # Replace ingredients
    await db.execute(
        delete(RecipeIngredient).where(RecipeIngredient.recipe_id == recipe.id)
    )
    
    for idx, ing_data in enumerate(recipe_data.ingredients):
        ingredient = await db.get(Ingredient, ing_data.ingredient_id)
        if not ingredient:
            raise HTTPException(status_code=400, detail=f"Ingrediente {ing_data.ingredient_id} no encontrado")
        
        recipe_ing = RecipeIngredient(
            recipe_id=recipe.id,
            ingredient_id=ing_data.ingredient_id,
            quantity=ing_data.quantity,
            unit=ing_data.unit,
            is_optional=ing_data.is_optional,
            sort_order=idx,
        )
        db.add(recipe_ing)
    
    await db.commit()
    
    # Reload with ingredients
    result = await db.execute(
        select(Recipe)
        .options(selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient))
        .where(Recipe.id == recipe.id)
    )
    recipe = result.scalar_one()
    
    return recipe


@router.delete("/product/{product_id}", status_code=204)
async def delete_recipe(
    product_id: int,
    current_user: User = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Delete recipe for a product."""
    result = await db.execute(select(Recipe).where(Recipe.product_id == product_id))
    recipe = result.scalar_one_or_none()
    
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    
    await db.delete(recipe)
    await db.commit()