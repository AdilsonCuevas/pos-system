# Categories Routes

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional

from app.database import get_db
from app.models.catalog import Category
from app.schemas.catalog import CategoryCreate, CategoryUpdate, CategoryResponse
from app.api.v1.routes.deps import get_current_user, require_permission, PaginationParams
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[CategoryResponse])
async def list_categories(
    parent_id: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(None),
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List categories with optional tree structure."""
    query = select(Category).where(Category.business_type == current_user.business_type)
    
    if parent_id is not None:
        query = query.where(Category.parent_id == parent_id)
    if is_active is not None:
        query = query.where(Category.is_active == is_active)
    
    query = query.order_by(Category.sort_order, Category.name).offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(query)
    categories = result.scalars().all()
    
    return categories


@router.get("/tree", response_model=List[CategoryResponse])
async def get_category_tree(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full category tree."""
    result = await db.execute(
        select(Category)
        .where(Category.business_type == current_user.business_type)
        .order_by(Category.sort_order, Category.name)
    )
    categories = result.scalars().all()
    
    # Build tree
    cat_dict = {c.id: CategoryResponse.model_validate(c, from_attributes=True) for c in categories}
    roots = []
    for c in categories:
        if c.parent_id and c.parent_id in cat_dict:
            if not hasattr(cat_dict[c.parent_id], 'children'):
                cat_dict[c.parent_id].children = []
            cat_dict[c.parent_id].children.append(cat_dict[c.id])
        else:
            roots.append(cat_dict[c.id])
    
    return roots


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
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
    return category


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get single category."""
    category = await db.get(Category, category_id)
    if not category or category.business_type != current_user.business_type:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return category


@router.put("/{category_id}", response_model=CategoryResponse)
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
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int,
    current_user: User = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Delete category (set inactive if has products)."""
    from app.models.catalog import Product
    from sqlalchemy import select, func
    
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