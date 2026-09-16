# Sales Routes

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, timezone

from app.database import get_db
from app.models.pos import Sale, SaleItem
from app.models.catalog import Product, ProductVariant
from app.models.restaurant import Ingredient, Recipe, RecipeIngredient
from app.models.inventory import InventoryMovement
from app.models.user import User
from app.schemas.pos import SaleCreate, SaleResponse, OfflineSale, SaleFilters
from app.services.pos import POSService
from app.api.v1.routes.deps import get_current_user, require_permission, require_role, PaginationParams, get_pagination

router = APIRouter()


@router.post("/", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
async def create_sale(
    sale_data: SaleCreate,
    current_user: User = Depends(require_permission("sales:write")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new sale (online)."""
    pos_service = POSService(db)
    response = await pos_service.create_sale(sale_data, current_user.id, 1)  # register_id = 1 default
    return response


@router.post("/sync", response_model=dict)
async def sync_offline_sales(
    sales: List[OfflineSale],
    current_user: User = Depends(require_permission("sales:write")),
    db: AsyncSession = Depends(get_db),
):
    """Batch sync offline sales."""
    pos_service = POSService(db)
    result = await pos_service.process_sync_queue(current_user.id)  # simplified
    return result


@router.get("/", response_model=List[SaleResponse])
async def list_sales(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(require_permission("sales:read")),
    db: AsyncSession = Depends(get_db),
):
    """List sales with filters."""
    query = select(Sale).options(
        selectinload(Sale.items).selectinload(SaleItem.product),
        selectinload(Sale.user),
        selectinload(Sale.fde_document)
    ).where(Sale.business_type == current_user.business_type)
    
    # Role-based filtering: cashiers only see their own sales
    if current_user.role == 'cashier':
        query = query.where(Sale.user_id == current_user.id)
    
    if from_date:
        query = query.where(Sale.created_at >= from_date)
    if to_date:
        query = query.where(Sale.created_at <= to_date)
    if status:
        query = query.where(Sale.status == status)
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0
    
    query = query.order_by(Sale.created_at.desc()).offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(query)
    sales = result.scalars().all()
    
    return sales


@router.get("/{sale_id}", response_model=SaleResponse)
async def get_sale(
    sale_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get single sale with details."""
    query = select(Sale).options(
        selectinload(Sale.items).selectinload(SaleItem.product).selectinload(Product.variants),
        selectinload(Sale.user),
        selectinload(Sale.fde_document)
    ).where(Sale.id == sale_id)
    
    if current_user.role == 'cashier':
        query = query.where(Sale.user_id == current_user.id)
    
    sale = (await db.execute(query)).scalar_one_or_none()
    
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    
    return sale


@router.post("/{sale_id}/refund", response_model=SaleResponse)
async def refund_sale(
    sale_id: int,
    items: List[dict],  # [{"sale_item_id": int, "quantity": int}]
    reason: str,
    current_user: User = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Process refund (partial or full)."""
    sale = await db.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    
    if sale.status != 'completed':
        raise HTTPException(status_code=400, detail="Solo se pueden reembolsar ventas completadas")
    
    # Process refund logic (simplified)
    # In real implementation: validate items, restore stock, create refund sale
    sale.status = 'refunded'
    await db.commit()
    
    return sale


@router.get("/{sale_id}/receipt")
async def get_receipt(
    sale_id: int,
    format: str = Query('escpos', pattern='^(escpos|pdf|html)$'),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate receipt in specified format."""
    sale = await db.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    
    if format == 'escpos':
        # Return ESC/POS commands
        from app.utils.escpos import EscPosBuilder
        builder = EscPosBuilder().init()
        builder.text('MI TIENDA', align='center', bold=True, size=2)
        builder.text(f'Venta: {sale.sale_number}')
        builder.text(f'Fecha: {sale.created_at.strftime("%d/%m/%Y %H:%M")}')
        builder.text(f'Cajero: {sale.user.name}')
        builder.text('-' * 32)
        
        for item in sale.items:
            builder.text(f'{item.product.name}  {item.quantity} x {item.unit_price}')
            builder.text(f'  {item.total_price}', align='right')
        
        builder.text('-' * 32)
        builder.text(f'Subtotal: {sale.subtotal}', align='right')
        builder.text(f'IVA: {sale.tax_amount}', align='right')
        builder.text(f'TOTAL: {sale.total}', align='right', bold=True, size=2)
        builder.text('-' * 32)
        builder.text('Gracias por su compra', align='center')
        builder.cut().kickDrawer()
        
        return Response(content=builder.build(), media_type='application/octet-stream')
    
    elif format == 'html':
        # Return HTML receipt for printing
        html = f"""
        <html><body style="font-family: monospace; width: 300px; margin: 0 auto;">
        <h2 style="text-align:center">MI TIENDA</h2>
        <p style="text-align:center">NIT: 900.123.456-7</p>
        <hr>
        <p>Venta: {sale.sale_number}</p>
        <p>Fecha: {sale.created_at.strftime('%d/%m/%Y %H:%M')}</p>
        <p>Cajero: {sale.user.name}</p>
        <hr>
        """
        for item in sale.items:
            html += f"<p>{item.product.name} {item.quantity} x {item.unit_price}</p>"
            html += f"<p style='text-align:right'>{item.total_price}</p>"
        html += f"""
        <hr>
        <p>Subtotal: {sale.subtotal}</p>
        <p>IVA: {sale.tax_amount}</p>
        <p><b>TOTAL: {sale.total}</b></p>
        <hr>
        <p style="text-align:center">Gracias por su compra</p>
        </body></html>
        """
        return Response(content=html, media_type='text/html')
    
    else:
        raise HTTPException(status_code=400, detail="Formato no soportado")