# Inventory Routes

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import List, Optional
from datetime import datetime, timezone

from app.database import get_db
from app.models.inventory import InventoryMovement, PurchaseOrder, PurchaseOrderItem, StockCount, StockCountItem
from app.models.catalog import Product
from app.models.restaurant import Ingredient
from app.models.user import User
from app.schemas.inventory import (
    InventoryAdjustment, InventoryMovementResponse,
    PurchaseOrderCreate, PurchaseOrderResponse,
    StockCountCreate, StockCountResponse,
)
from app.services.pos import POSService
from app.api.v1.routes.deps import get_current_user, require_permission, require_role, PaginationParams
from app.models.pos import Sale

router = APIRouter()


# Inventory Adjustments
@router.post("/adjustments", response_model=InventoryMovementResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_adjustment(
    adjustment: InventoryAdjustment,
    current_user: User = Depends(require_permission("inventory:adjust")),
    db: AsyncSession = Depends(get_db),
):
    """Create inventory adjustment (entry/exit/adjustment)."""
    pos_service = POSService(db)
    movement = await pos_service.adjust_stock(adjustment, current_user.id)
    return movement


@router.get("/movements", response_model=List[InventoryMovementResponse])
async def list_movements(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    reference_type: Optional[str] = Query(None),
    reference_id: Optional[int] = Query(None),
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(require_permission("inventory:read")),
    db: AsyncSession = Depends(get_db),
):
    """List inventory movements with filters."""
    query = select(InventoryMovement).options(selectinload(InventoryMovement.user))
    
    if from_date:
        query = query.where(InventoryMovement.created_at >= from_date)
    if to_date:
        query = query.where(InventoryMovement.created_at <= to_date)
    if type:
        query = query.where(InventoryMovement.type == type)
    if reference_type:
        query = query.where(InventoryMovement.reference_type == reference_type)
    if reference_id:
        query = query.where(InventoryMovement.reference_id == reference_id)
    
    query = query.order_by(InventoryMovement.created_at.desc()).offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(query)
    movements = result.scalars().all()
    
    return movements


@router.get("/reports/low-stock")
async def get_low_stock_report(
    current_user: User = Depends(require_permission("reports:read")),
    db: AsyncSession = Depends(get_db),
):
    """Get products/ingredients below minimum stock."""
    from app.models.catalog import Product
    from app.models.restaurant import Ingredient
    from sqlalchemy import select
    
    alerts = []
    
    # Products
    result = await db.execute(
        select(Product)
        .where(
            Product.track_stock == True,
            Product.current_stock <= Product.min_stock,
            Product.min_stock > 0,
            Product.is_active == True,
        )
    )
    for product in result.scalars().all():
        alerts.append({
            'type': 'product',
            'id': product.id,
            'name': product.name,
            'sku': product.sku,
            'current_stock': float(product.current_stock),
            'min_stock': float(product.min_stock),
            'unit': product.unit,
        })
    
    # Ingredients (restaurant only)
    if current_user.business_type == 'restaurant':
        result = await db.execute(
            select(Ingredient)
            .where(
                Ingredient.current_stock <= Ingredient.min_stock,
                Ingredient.min_stock > 0,
                Ingredient.is_active == True,
            )
        )
        for ingredient in result.scalars().all():
            alerts.append({
                'type': 'ingredient',
                'id': ingredient.id,
                'name': ingredient.name,
                'current_stock': float(ingredient.current_stock),
                'min_stock': float(ingredient.min_stock),
                'unit': ingredient.unit,
            })
    
    return alerts


@router.get("/reports/valuation")
async def get_inventory_valuation(
    current_user: User = Depends(require_permission("reports:read")),
    db: AsyncSession = Depends(get_db),
):
    """Get inventory valuation report."""
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
    
    return {
        'total_value': float(total_value),
        'products_value': float(product_val.total or 0),
        'ingredients_value': float(ingredient_val.total or 0),
        'by_category': by_category,
    }


# Purchase Orders
@router.post("/purchase-orders", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    po_data: PurchaseOrderCreate,
    current_user: User = Depends(require_permission("inventory:write")),
    db: AsyncSession = Depends(get_db),
):
    """Create purchase order."""
    from app.models.inventory import PurchaseOrder, PurchaseOrderItem
    
    po = PurchaseOrder(
        po_number=po_data.po_number,
        supplier_name=po_data.supplier_name,
        supplier_tax_id=po_data.supplier_tax_id,
        expected_date=po_data.expected_date,
        notes=po_data.notes,
        created_by=current_user.id,
    )
    db.add(po)
    await db.flush()
    
    total = 0
    for item in po_data.items:
        po_item = PurchaseOrderItem(
            po_id=po.id,
            reference_type=item.reference_type,
            reference_id=item.reference_id,
            quantity=item.quantity,
            unit_cost=item.unit_cost,
        )
        db.add(po_item)
        total += item.quantity * item.unit_cost
    
    po.total_amount = total
    await db.commit()
    await db.refresh(po)
    
    return po


@router.get("/purchase-orders", response_model=List[PurchaseOrderResponse])
async def list_purchase_orders(
    status: Optional[str] = Query(None),
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(require_permission("inventory:read")),
    db: AsyncSession = Depends(get_db),
):
    """List purchase orders."""
    from app.models.inventory import PurchaseOrder
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    
    query = select(PurchaseOrder).options(
        selectinload(PurchaseOrder.items),
        selectinload(PurchaseOrder.creator)
    ).order_by(PurchaseOrder.created_at.desc())
    
    if status:
        query = query.where(PurchaseOrder.status == status)
    
    query = query.offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(query)
    pos = result.scalars().all()
    
    return pos


@router.post("/purchase-orders/{po_id}/receive", status_code=200)
async def receive_purchase_order(
    po_id: int,
    items: List[dict],  # [{"item_id": int, "received_quantity": float}]
    current_user: User = Depends(require_permission("inventory:write")),
    db: AsyncSession = Depends(get_db),
):
    """Mark purchase order items as received and update stock."""
    from app.models.inventory import PurchaseOrder, PurchaseOrderItem
    from app.models.catalog import Product
    from app.models.restaurant import Ingredient
    from app.models.inventory import InventoryMovement
    from datetime import datetime, timezone
    
    po = await db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="Orden de compra no encontrada")
    
    if po.status == 'received':
        raise HTTPException(status_code=400, detail="Orden ya recibida")
    
    all_received = True
    for item_data in items:
        po_item = await db.get(PurchaseOrderItem, item_data['item_id'])
        if not po_item or po_item.po_id != po_id:
            continue
        
        received_qty = item_data['received_quantity']
        po_item.received_quantity += received_qty
        
        # Update stock
        if po_item.reference_type == 'product':
            product = await db.get(Product, po_item.reference_id)
            if product:
                product.current_stock += received_qty
                movement = InventoryMovement(
                    type='entry', reference_type='product', reference_id=po_item.reference_id,
                    quantity=received_qty, unit_cost=po_item.unit_cost,
                    reason='compra', reference=po.po_number, user_id=current_user.id
                )
                db.add(movement)
        elif po_item.reference_type == 'ingredient':
            ingredient = await db.get(Ingredient, po_item.reference_id)
            if ingredient:
                ingredient.current_stock += received_qty
                movement = InventoryMovement(
                    type='entry', reference_type='ingredient', reference_id=po_item.reference_id,
                    quantity=received_qty, unit_cost=po_item.unit_cost,
                    reason='compra', reference=po.po_number, user_id=current_user.id
                )
                db.add(movement)
        
        if po_item.received_quantity < po_item.quantity:
            all_received = False
    
    po.status = 'received' if all_received else 'sent'
    if all_received:
        po.received_date = datetime.now(timezone.utc).date()
    
    await db.commit()
    return {"message": "Orden recibida correctamente"}


# Stock Counts
@router.post("/counts", response_model=StockCountResponse, status_code=status.HTTP_201_CREATED)
async def create_stock_count(
    count_data: StockCountCreate,
    current_user: User = Depends(require_permission("inventory:write")),
    db: AsyncSession = Depends(get_db),
):
    """Create new stock count session."""
    from app.models.inventory import StockCount, StockCountItem
    from app.models.catalog import Product
    from app.models.restaurant import Ingredient
    from sqlalchemy import select
    
    count = StockCount(
        name=count_data.name,
        type=count_data.type,
        created_by=current_user.id,
        notes=count_data.notes,
    )
    db.add(count)
    await db.flush()
    
    # Add all products/ingredients to count
    items_to_count = []
    
    if count_data.type in ['full', 'partial']:
        products = await db.execute(select(Product.id).where(Product.is_active == True))
        for p_id in products.scalars().all():
            product = await db.get(Product, p_id)
            items_to_count.append(StockCountItem(
                count_id=count.id,
                reference_type='product',
                reference_id=product.id,
                expected_quantity=product.current_stock,
            ))
    
    if count_data.type in ['full', 'partial'] and current_user.business_type == 'restaurant':
        ingredients = await db.execute(select(Ingredient.id).where(Ingredient.is_active == True))
        for i_id in ingredients.scalars().all():
            ingredient = await db.get(Ingredient, i_id)
            items_to_count.append(StockCountItem(
                count_id=count.id,
                reference_type='ingredient',
                reference_id=ingredient.id,
                expected_quantity=ingredient.current_stock,
            ))
    
    for item in items_to_count:
        db.add(item)
    
    await db.commit()
    await db.refresh(count)
    return count


@router.get("/counts", response_model=List[StockCountResponse])
async def list_stock_counts(
    status: Optional[str] = Query(None),
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(require_permission("inventory:read")),
    db: AsyncSession = Depends(get_db),
):
    """List stock counts."""
    from app.models.inventory import StockCount
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    
    query = select(StockCount).options(selectinload(StockCount.creator)).order_by(StockCount.started_at.desc())
    
    if status:
        query = query.where(StockCount.status == status)
    
    query = query.offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(query)
    counts = result.scalars().all()
    
    return counts


@router.post("/counts/{count_id}/finalize", status_code=200)
async def finalize_stock_count(
    count_id: int,
    current_user: User = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Finalize stock count and create adjustments for variances."""
    from app.models.inventory import StockCount, StockCountItem, InventoryMovement
    from app.models.catalog import Product
    from app.models.restaurant import Ingredient
    from datetime import datetime, timezone
    from sqlalchemy import select
    
    count = await db.get(StockCount, count_id)
    if not count:
        raise HTTPException(status_code=404, detail="Conteo no encontrado")
    
    if count.status != 'in_progress':
        raise HTTPException(status_code=400, detail="Conteo ya finalizado")
    
    # Get all items
    result = await db.execute(select(StockCountItem).where(StockCountItem.count_id == count_id))
    items = result.scalars().all()
    
    for item in items:
        if item.counted_quantity is None:
            raise HTTPException(status_code=400, detail=f"Falta contar: {item.reference_type} {item.reference_id}")
        
        variance = item.variance
        if variance != 0:
            # Create adjustment
            movement = InventoryMovement(
                type='count',
                reference_type=item.reference_type,
                reference_id=item.reference_id,
                quantity=variance,
                unit_cost=None,
                reason='conteo',
                reference=count.name,
                user_id=current_user.id,
                notes=f"Variación en conteo: {variance}",
                created_at=datetime.now(timezone.utc),
            )
            db.add(movement)
            
            # Update actual stock
            if item.reference_type == 'product':
                product = await db.get(Product, item.reference_id)
                if product:
                    product.current_stock = item.counted_quantity
            elif item.reference_type == 'ingredient':
                ingredient = await db.get(Ingredient, item.reference_id)
                if ingredient:
                    ingredient.current_stock = item.counted_quantity
    
    count.status = 'completed'
    count.completed_at = datetime.now(timezone.utc)
    await db.commit()
    
    return {"message": "Conteo finalizado, ajustes aplicados"}