# Reports Routes

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_, case
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, date, timezone, timedelta

from app.database import get_db
from app.models.pos import Sale, SaleItem
from app.models.catalog import Product, Category, ProductVariant
from app.models.restaurant import Ingredient, Recipe, RecipeIngredient
from app.models.inventory import InventoryMovement
from app.models.user import User
from app.api.v1.routes.deps import get_current_user, require_permission, PaginationParams

router = APIRouter()


@router.get("/sales")
async def sales_report(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    group_by: Optional[str] = Query(None, pattern='^(day|week|month|category|payment_method|user)$'),
    current_user: User = Depends(require_permission("reports:read")),
    db: AsyncSession = Depends(get_db),
):
    """Sales report with flexible grouping."""
    query = select(Sale).where(Sale.business_type == current_user.business_type)
    
    # Role-based filtering
    if current_user.role == 'cashier':
        query = query.where(Sale.user_id == current_user.id)
    
    if from_date:
        query = query.where(Sale.created_at >= from_date)
    if to_date:
        query = query.where(Sale.created_at <= to_date)
    if payment_method:
        query = query.where(Sale.payment_method.contains([{"method": payment_method}]))
    
    query = query.where(Sale.status == 'completed')
    
    # Get all sales for processing
    result = await db.execute(query.order_by(Sale.created_at))
    sales = result.scalars().all()
    
    if not sales:
        return {
            "period": {"from": from_date, "to": to_date},
            "total_sales": 0,
            "total_revenue": 0,
            "avg_ticket": 0,
            "by_payment_method": [],
            "by_category": [],
            "by_hour": [],
        }
    
    # Process sales
    total_sales = len(sales)
    total_revenue = sum(s.total for s in sales)
    avg_ticket = total_revenue / total_sales if total_sales > 0 else 0
    
    # By payment method
    payment_totals = {}
    for sale in sales:
        for pm in sale.payment_method:
            method = pm.get('method', 'unknown')
            amount = pm.get('amount', 0)
            payment_totals[method] = payment_totals.get(method, {'amount': 0, 'count': 0})
            payment_totals[method]['amount'] += amount
            payment_totals[method]['count'] += 1
    
    # By category (from sale items)
    category_totals = {}
    for sale in sales:
        for item in sale.items:
            # Would need to join with product -> category
            cat_name = item.product.category.name if item.product and item.product.category else 'Sin categoría'
            cat_totals[cat_name] = cat_totals.get(cat_name, {'revenue': 0, 'count': 0})
            cat_totals[cat_name]['revenue'] += item.total_price
            cat_totals[cat_name]['count'] += item.quantity
    
    # By hour
    hour_totals = {}
    for sale in sales:
        hour = sale.created_at.hour
        hour_totals[hour] = hour_totals.get(hour, 0) + sale.total
    
    return {
        "period": {"from": from_date, "to": to_date},
        "total_sales": total_sales,
        "total_revenue": sum(s.total for s in sales),
        "avg_ticket": avg_ticket,
        "by_payment_method": [
            {"method": k, "amount": v['amount'], "count": v['count']}
            for k, v in payment_totals.items()
        ],
        "by_category": [
            {"category": k, "revenue": v['revenue'], "count": v['count']}
            for k, v in category_totals.items()
        ],
        "by_hour": [
            {"hour": k, "revenue": v}
            for k, v in sorted(hour_totals.items())
        ],
    }


@router.get("/inventory/valuation")
async def inventory_valuation_report(
    current_user: User = Depends(require_permission("reports:read")),
    db: AsyncSession = Depends(get_db),
):
    """Inventory valuation report."""
    from app.models.catalog import Product, Category
    from app.models.restaurant import Ingredient
    from sqlalchemy import select, func
    
    # Products value
    product_result = await db.execute(
        select(
            func.sum(Product.current_stock * Product.cost).label('total'),
            func.count(Product.id).label('count')
        )
        .where(Product.track_stock == True, Product.is_active == True)
    )
    product_val = product_result.first()
    
    # Ingredients value
    ingredient_result = await db.execute(
        select(
            func.sum(Ingredient.current_stock * Ingredient.cost_per_unit).label('total'),
            func.count(Ingredient.id).label('count')
        )
        .where(Ingredient.is_active == True)
    )
    ingredient_val = ingredient_result.first()
    
    total_value = (product_val.total or 0) + (ingredient_val.total or 0)
    
    # By category
    from app.models.catalog import Category
    cat_result = await db.execute(
        select(
            Category.name,
            func.sum(Product.current_stock * Product.cost).label('value'),
            func.count(Product.id).label('items')
        )
        .join(Product, Product.category_id == Category.id)
        .where(Product.track_stock == True, Product.is_active == True)
        .group_by(Category.id, Category.name)
    )
    
    by_category = [
        {'category': row.name, 'value': float(row.value or 0), 'items': row.items}
        for row in cat_result.all()
    ]
    
    # Top 10 highest value items
    top_items_result = await db.execute(
        select(Product.name, Product.current_stock, Product.cost, (Product.current_stock * Product.cost).label('value'))
        .where(Product.track_stock == True, Product.is_active == True)
        .order_by((Product.current_stock * Product.cost).desc())
        .limit(10)
    )
    
    top_items = [
        {'name': row.name, 'stock': float(row.current_stock), 'cost': float(row.cost), 'value': float(row.value or 0)}
        for row in top_items_result.all()
    ]
    
    # Zero stock items
    zero_stock_result = await db.execute(
        select(Product.name, Product.sku)
        .where(Product.track_stock == True, Product.is_active == True, Product.current_stock <= 0)
        .limit(20)
    )
    
    zero_stock = [{'name': row.name, 'sku': row.sku} for row in zero_stock_result.all()]
    
    return {
        'total_value': float(total_value),
        'products_value': float(product_val.total or 0),
        'ingredients_value': float(ingredient_val.total or 0),
        'by_category': by_category,
        'top_items': top_items,
        'zero_stock': zero_stock,
    }


@router.get("/recipes/cost-analysis")
async def recipe_cost_analysis(
    current_user: User = Depends(require_permission("reports:read")),
    db: AsyncSession = Depends(get_db),
):
    """Recipe cost and margin analysis (restaurant only)."""
    if current_user.business_type != 'restaurant':
        raise HTTPException(status_code=403, detail="Solo disponible para restaurantes")
    
    from app.models.restaurant import Recipe, RecipeIngredient, Ingredient
    from app.models.catalog import Product
    from sqlalchemy import select
    
    result = await db.execute(
        select(Recipe).options(selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient))
        .join(Product, Product.id == Recipe.product_id)
        .where(Product.is_active == True)
    )
    recipes = result.scalars().all()
    
    analysis = []
    for recipe in recipes:
        recipe_cost = 0
        ingredient_details = []
        
        for ri in recipe.ingredients:
            ingredient = ri.ingredient
            cost = ri.quantity * ingredient.cost_per_unit
            recipe_cost += cost
            ingredient_details.append({
                'name': ingredient.name,
                'quantity': float(ri.quantity),
                'unit': ri.unit,
                'cost_per_unit': float(ingredient.cost_per_unit),
                'total_cost': float(cost),
            })
        
        sale_price = recipe.product.price if recipe.product else 0
        margin_amount = sale_price - recipe_cost
        margin_percent = (margin_amount / sale_price * 100) if sale_price > 0 else 0
        
        analysis.append({
            'product_id': recipe.product_id,
            'product_name': recipe.product.name if recipe.product else 'N/A',
            'sale_price': float(sale_price),
            'recipe_cost': float(recipe_cost),
            'margin_percent': float(margin_percent),
            'margin_amount': float(margin_amount),
            'ingredients': ingredient_details,
        })
    
    return analysis