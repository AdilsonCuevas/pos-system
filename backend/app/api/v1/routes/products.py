# Products Routes

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.database import get_db
from app.models.catalog import Product, ProductVariant, Category
from app.models.restaurant import Recipe, RecipeIngredient, Ingredient
from app.schemas.catalog import (
    ProductCreate, ProductUpdate, ProductResponse,
    ProductVariantCreate, ProductVariantResponse,
    CategoryCreate, CategoryUpdate, CategoryResponse,
)
from app.api.v1.routes.deps import get_current_user, require_permission, require_role, PaginationParams
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[ProductResponse])
async def list_products(
    search: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List products with filters and availability."""
    query = select(Product).options(
        selectinload(Product.category),
        selectinload(Product.variants),
        selectinload(Product.recipe).selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient)
    ).where(Product.business_type == current_user.business_type)
    
    if search:
        query = query.where(
            or_(
                Product.name.ilike(f"%{search}%"),
                Product.sku.ilike(f"%{search}%"),
            )
        )
    if category_id:
        query = query.where(Product.category_id == category_id)
    if type:
        query = query.where(Product.type == type)
    if is_active is not None:
        query = query.where(Product.is_active == is_active)
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0
    
    query = query.order_by(Product.sort_order, Product.name).offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(query)
    products = result.scalars().all()
    
    # Add availability for composite products
    response = []
    for p in products:
        available = None
        limiting = None
        if p.type == 'composite' and p.recipe_id:
            recipe = p.recipe
            if recipe:
                min_available = 999999
                for ri in recipe.ingredients:
                    ing = await db.get(Ingredient, ri.ingredient_id)
                    if ing:
                        avail = int(ing.current_stock / ri.quantity)
                        if avail < min_available:
                            min_available = avail
                            limiting = {"ingredient_id": ing.id, "name": ing.name, "available": float(ing.current_stock), "unit": ing.unit}
                available = max(0, min_available)
        
        response.append(ProductResponse(
            **p.__dict__,
            available=available,
            limiting_ingredient=limiting,
        ))
    
    return response


@router.get("/categories/tree", response_model=List[CategoryResponse])
async def get_category_tree(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get hierarchical category tree."""
    result = await db.execute(
        select(Category)
        .where(Category.business_type == current_user.business_type)
        .order_by(Category.sort_order, Category.name)
    )
    categories = result.scalars().all()
    
    # Build tree
    cat_dict = {c.id: CategoryResponse(**c.__dict__, children=[]) for c in categories}
    roots = []
    for c in categories:
        if c.parent_id and c.parent_id in cat_dict:
            cat_dict[c.parent_id].children.append(cat_dict[c.id])
        else:
            roots.append(cat_dict[c.id])
    
    return roots


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get single product with details."""
    result = await db.execute(
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.variants),
            selectinload(Product.recipe).selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient)
        )
        .where(Product.id == product_id, Product.business_type == current_user.business_type)
    )
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    return ProductResponse(**product.__dict__)


@router.get("/{product_id}/availability")
async def get_product_availability(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get real-time availability for a product."""
    product = await db.get(Product, product_id)
    if not product or product.business_type != current_user.business_type:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    if product.type == 'simple':
        available = int(product.current_stock) if product.track_stock else 999999
        return {"available": available, "limiting_ingredient": None}
    
    # Composite product
    if product.recipe_id:
        recipe = await db.get(Recipe, product.recipe_id)
        if recipe:
            min_available = 999999
            limiting = None
            for ri in recipe.ingredients:
                ing = await db.get(Ingredient, ri.ingredient_id)
                if ing:
                    avail = int(ing.current_stock / ri.quantity)
                    if avail < min_available:
                        min_available = avail
                        limiting = {"ingredient_id": ing.id, "name": ing.name, "available": float(ing.current_stock), "unit": ing.unit}
            return {"available": max(0, min_available), "limiting_ingredient": limiting}
    
    return {"available": 0, "limiting_ingredient": None}


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    product_data: ProductCreate,
    current_user: User = Depends(require_permission("products:write")),
    db: AsyncSession = Depends(get_db),
):
    """Create new product."""
    # Validate SKU unique
    existing = await db.execute(select(Product).where(Product.sku == product_data.sku))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="SKU ya existe")
    
    # Validate category
    category = await db.get(Category, product_data.category_id)
    if not category or category.business_type != current_user.business_type:
        raise HTTPException(status_code=400, detail="Categoría inválida")
    
    # Validate recipe for composite products
    if product_data.type == 'composite' and product_data.recipe_id:
        recipe = await db.get(Recipe, product_data.recipe_id)
        if not recipe or recipe.product_id:
            raise HTTPException(status_code=400, detail="Receta inválida o ya asignada")
    
    product = Product(
        **product_data.model_dump(exclude={'variants'}),
        business_type=current_user.business_type,
    )
    db.add(product)
    await db.flush()
    
    # Create variants
    if product_data.variants:
        for v in product_data.variants:
            variant = ProductVariant(product_id=product.id, **v.model_dump())
            db.add(variant)
    
    await db.commit()
    await db.refresh(product)
    
    return ProductResponse(**product.__dict__)


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    product_data: ProductUpdate,
    current_user: User = Depends(require_permission("products:write")),
    db: AsyncSession = Depends(get_db),
):
    """Update product."""
    product = await db.get(Product, product_id)
    if not product or product.business_type != current_user.business_type:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    # Check SKU uniqueness if changed
    if product_data.sku and product_data.sku != product.sku:
        existing = await db.execute(select(Product).where(Product.sku == product_data.sku))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="SKU ya existe")
    
    # Update fields
    for field, value in product_data.model_dump(exclude_unset=True, exclude={'variants'}).items():
        setattr(product, field, value)
    
    # Update variants if provided
    if product_data.variants is not None:
        # Delete existing variants
        await db.execute(
            ProductVariant.__table__.delete().where(ProductVariant.product_id == product_id)
        )
        # Create new variants
        for v in product_data.variants:
            variant = ProductVariant(product_id=product_id, **v.model_dump())
            db.add(variant)
    
    await db.commit()
    await db.refresh(product)
    
    return ProductResponse(**product.__dict__)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int,
    current_user: User = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete product (set inactive)."""
    product = await db.get(Product, product_id)
    if not product or product.business_type != current_user.business_type:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    product.is_active = False
    await db.commit()


# Category Routes
@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: CategoryCreate,
    current_user: User = Depends(require_permission("categories:write")),
    db: AsyncSession = Depends(get_db),
):
    """Create new category."""
    if category_data.parent_id:
        parent = await db.get(Category, category_data.parent_id)
        if not parent or parent.business_type != current_user.business_type:
            raise HTTPException(status_code=400, detail="Categoría padre inválida")
    
    category = Category(
        **category_data.model_dump(),
        business_type=current_user.business_type,
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    
    return CategoryResponse(**category.__dict__)


@router.put("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    category_data: CategoryUpdate,
    current_user: User = Depends(require_permission("categories:write")),
    db: AsyncSession = Depends(get_db),
):
    """Update category."""
    category = await db.get(Category, category_id)
    if not category or category.business_type != current_user.business_type:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    
    for field, value in category_data.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    
    await db.commit()
    await db.refresh(category)
    
    return CategoryResponse(**category.__dict__)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int,
    current_user: User = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Delete category (set inactive if has products)."""
    category = await db.get(Category, category_id)
    if not category or category.business_type != current_user.business_type:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    
    # Check if has products
    products_count = await db.scalar(
        select(func.count(Product.id)).where(Product.category_id == category_id)
    )
    if products_count and products_count > 0:
        category.is_active = False
    else:
        await db.delete(category)
    
    await db.commit()