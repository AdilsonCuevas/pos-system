# POS Service - Sale Processing, Stock Management, Offline Sync

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload

from app.models.pos import Sale, SaleItem
from app.models.catalog import Product, ProductVariant
from app.models.restaurant import Ingredient, Recipe, RecipeIngredient
from app.models.inventory import InventoryMovement
from app.models.user import User
from app.models.sync import SyncQueue
from app.schemas.pos import SaleCreate, OfflineSale, SaleResponse
from app.schemas.inventory import InventoryAdjustment
from app.utils.security import format_cop


class POSService:
    """Core POS business logic."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_sale(self, sale_data: SaleCreate, user_id: int, register_id: int) -> SaleResponse:
        """Create a new sale with atomic stock deduction."""
        
        # Validate and calculate totals
        subtotal = Decimal('0')
        tax_amount = Decimal('0')
        items_to_create = []
        stock_deductions = []  # (reference_type, reference_id, quantity, unit_cost)
        
        for item_data in sale_data.items:
            # Get product
            product = await self.db.get(Product, item_data.product_id)
            if not product or not product.is_active:
                raise ValueError(f"Producto {item_data.product_id} no encontrado o inactivo")
            
            # Get variant if specified
            variant = None
            if item_data.variant_id:
                variant = await self.db.get(ProductVariant, item_data.variant_id)
                if not variant or variant.product_id != product.id:
                    raise ValueError(f"Variante {item_data.variant_id} no válida para este producto")
            
            # Calculate price
            unit_price = item_data.unit_price
            if variant:
                unit_price = product.price + variant.price_delta
            
            # Validate stock for simple products
            if product.type == 'simple' and product.track_stock:
                if product.current_stock < item_data.quantity:
                    raise ValueError(f"Stock insuficiente para {product.name}: disponible {product.current_stock}, solicitado {item_data.quantity}")
            
            # For composite products, validate ingredient stock
            ingredient_consumption = []
            if product.type == 'composite' and product.recipe_id:
                recipe = await self.db.get(Recipe, product.recipe_id)
                if recipe:
                    for ri in recipe.ingredients:
                        ingredient = await self.db.get(Ingredient, ri.ingredient_id)
                        if not ingredient:
                            raise ValueError(f"Ingrediente {ri.ingredient_id} no encontrado")
                        
                        needed_qty = ri.quantity * item_data.quantity
                        if ingredient.current_stock < needed_qty:
                            raise ValueError(
                                f"Stock insuficiente de ingrediente {ingredient.name}: "
                                f"disponible {ingredient.current_stock} {ingredient.unit}, "
                                f"necesario {needed_qty} {ingredient.unit}"
                            )
                        
                        ingredient_consumption.append({
                            "ingredient_id": ingredient.id,
                            "quantity": float(needed_qty),
                            "unit": ingredient.unit,
                        })
                        stock_deductions.append(('ingredient', ingredient.id, needed_qty, ingredient.cost_per_unit))
            
            # Process modifiers
            modifier_price_delta = Decimal('0')
            modifier_ingredients = []
            if item_data.modifiers:
                for mod in item_data.modifiers:
                    # In a full implementation, fetch modifier details
                    modifier_price_delta += Decimal(str(mod.get('price_delta', 0)))
                    
                    # Check if modifier affects ingredient stock
                    if mod.get('ingredient_id') and mod.get('ingredient_quantity'):
                        ingredient = await self.db.get(Ingredient, mod['ingredient_id'])
                        if ingredient:
                            needed = Decimal(str(mod['ingredient_quantity'])) * item_data.quantity
                            if ingredient.current_stock < needed:
                                raise ValueError(f"Stock insuficiente para modificador {mod.get('name')}")
                            modifier_ingredients.append({
                                "ingredient_id": ingredient.id,
                                "quantity": float(needed),
                                "unit": ingredient.unit,
                            })
                            stock_deductions.append(('ingredient', ingredient.id, needed, ingredient.cost_per_unit))
            
            # Calculate totals
            line_subtotal = unit_price * item_data.quantity
            line_tax = line_subtotal * product.tax_rate
            line_total = line_subtotal + line_tax + (modifier_price_delta * item_data.quantity)
            
            subtotal += line_subtotal
            tax_amount += line_tax
            
            items_to_create.append({
                'product_id': product.id,
                'variant_id': item_data.variant_id,
                'quantity': item_data.quantity,
                'unit_price': unit_price,
                'total_price': line_total,
                'modifiers': item_data.modifiers,
                'ingredient_consumption': ingredient_consumption + modifier_ingredients,
            })
            
            # Track product stock deduction
            if product.type == 'simple' and product.track_stock:
                stock_deductions.append(('product', product.id, item_data.quantity, product.cost))
        
        # Calculate final totals
        discount = Decimal(str(sale_data.discount_amount or 0))
        total = subtotal + tax_amount - discount
        
        # Process payments
        paid_total = Decimal('0')
        for payment in sale_data.payments:
            paid_total += Decimal(str(payment['amount']))
        
        if paid_total < total:
            raise ValueError(f"Pago insuficiente: total {total}, pagado {paid_total}")
        
        change = paid_total - total
        
        # Generate sale number
        sale_number = await self._generate_sale_number()
        
        # Create sale record
        sale = Sale(
            sale_number=sale_number,
            user_id=user_id,
            register_id=register_id,
            business_type=sale_data.business_type,
            status='completed',
            subtotal=subtotal,
            tax_amount=tax_amount,
            discount_amount=discount,
            total=total,
            change_amount=change,
            payment_method=sale_data.payments,
            customer_id=sale_data.customer_id,
            customer_name=sale_data.customer_name,
            customer_tax_id=sale_data.customer_tax_id,
            customer_email=sale_data.customer_email,
            notes=sale_data.notes,
            synced_at=datetime.now(timezone.utc),
        )
        
        self.db.add(sale)
        await self.db.flush()  # Get sale.id
        
        # Create sale items
        for idx, item_data in enumerate(items_to_create):
            sale_item = SaleItem(
                sale_id=sale.id,
                product_id=item_data['product_id'],
                variant_id=item_data['variant_id'],
                quantity=item_data['quantity'],
                unit_price=item_data['unit_price'],
                total_price=item_data['total_price'],
                modifiers=item_data['modifiers'],
                ingredient_consumption=item_data['ingredient_consumption'],
                sort_order=idx,
            )
            self.db.add(sale_item)
        
        # Deduct stock atomically
        await self._deduct_stock(stock_deductions, sale.sale_number, user_id)
        
        await self.db.commit()
        await self.db.refresh(sale)
        
        return SaleResponse(
            sale=sale,
            receipt_url=f"/api/sales/{sale.id}/receipt",
            fde_required=await self._check_fde_required(sale),
        )
    
    async def _deduct_stock(
        self,
        deductions: List[tuple],
        reference: str,
        user_id: int,
    ) -> None:
        """Deduct stock and record inventory movements."""
        
        for ref_type, ref_id, qty, unit_cost in deductions:
            if ref_type == 'product':
                product = await self.db.get(Product, ref_id)
                if product and product.track_stock:
                    product.current_stock -= qty
                    
                    movement = InventoryMovement(
                        type='sale',
                        reference_type='product',
                        reference_id=ref_id,
                        quantity=-qty,
                        unit_cost=unit_cost,
                        reason='venta',
                        reference=reference,
                        user_id=user_id,
                    )
                    self.db.add(movement)
            
            elif ref_type == 'ingredient':
                ingredient = await self.db.get(Ingredient, ref_id)
                if ingredient:
                    ingredient.current_stock -= qty
                    
                    movement = InventoryMovement(
                        type='sale',
                        reference_type='ingredient',
                        reference_id=ref_id,
                        quantity=-qty,
                        unit_cost=unit_cost,
                        reason='venta',
                        reference=reference,
                        user_id=user_id,
                    )
                    self.db.add(movement)
    
    async def _generate_sale_number(self) -> str:
        """Generate unique sale number: POS-YYYYMMDD-XXXX"""
        today = datetime.now(timezone.utc).strftime('%Y%m%d')
        
        # Count today's sales
        result = await self.db.execute(
            select(func.count(Sale.id))
            .where(Sale.sale_number.like(f'POS-{today}-%'))
        )
        count = result.scalar() or 0
        
        return f'POS-{today}-{count + 1:04d}'
    
    async def _check_fde_required(self, sale: Sale) -> bool:
        """Check if sale requires FDE (Factura Electrónica)."""
        # In Colombia, POS tickets don't require full invoice unless customer requests
        # Full invoices (FAC) required for B2B or amounts over threshold
        return sale.customer_tax_id is not None  # Customer provided NIT/CC
    
    async def process_offline_sale(self, offline_sale: OfflineSale, device_id: str) -> SaleResponse:
        """Process a sale from offline queue."""
        # Check for duplicate (idempotency)
        existing = await self.db.execute(
            select(SyncQueue).where(
                SyncQueue.device_id == device_id,
                SyncQueue.entity_type == 'sale',
                SyncQueue.payload.contains({'local_id': offline_sale.local_id})
            )
        )
        if existing.scalar_one_or_none():
            # Already processed
            raise ValueError("Venta ya procesada")
        
        # Convert to SaleCreate
        sale_create = SaleCreate(
            items=offline_sale.items,
            payments=offline_sale.payments,
            customer=offline_sale.customer,
            notes=offline_sale.notes,
        )
        
        # Create sale
        response = await self.create_sale(
            sale_create,
            offline_sale.user_id,
            offline_sale.register_id,
        )
        
        # Mark as synced
        return response
    
    async def process_sync_queue(self, device_id: str) -> Dict[str, Any]:
        """Process all pending operations for a device."""
        # Get pending operations
        result = await self.db.execute(
            select(SyncQueue)
            .where(
                SyncQueue.device_id == device_id,
                SyncQueue.status == 'pending'
            )
            .order_by(SyncQueue.created_at)
            .limit(50)  # Process in batches
        )
        operations = result.scalars().all()
        
        synced = []
        failed = []
        conflicts = []
        
        for op in operations:
            try:
                op.status = 'processing'
                await self.db.commit()
                
                if op.entity_type == 'sale':
                    offline_sale = OfflineSale(**op.payload)
                    await self.process_offline_sale(offline_sale, device_id)
                    synced.append(op.id)
                
                elif op.entity_type == 'inventory_movement':
                    adjustment = InventoryAdjustment(**op.payload)
                    await self.adjust_stock(adjustment, op.payload.get('user_id'))
                    synced.append(op.id)
                
                op.status = 'synced'
                op.synced_at = datetime.now(timezone.utc)
                
            except ValueError as e:
                if 'ya procesada' in str(e):
                    op.status = 'synced'
                    op.synced_at = datetime.now(timezone.utc)
                    synced.append(op.id)
                else:
                    op.status = 'failed'
                    op.last_error = str(e)
                    op.retry_count += 1
                    failed.append({'id': op.id, 'error': str(e)})
            
            except Exception as e:
                op.status = 'failed'
                op.last_error = str(e)
                op.retry_count += 1
                failed.append({'id': op.id, 'error': str(e)})
            
            await self.db.commit()
        
        return {
            'synced': synced,
            'failed': failed,
            'conflicts': conflicts,
        }
    
    async def adjust_stock(self, adjustment: InventoryAdjustment, user_id: int) -> InventoryMovement:
        """Adjust stock for product or ingredient."""
        if adjustment.reference_type == 'product':
            product = await self.db.get(Product, adjustment.reference_id)
            if not product:
                raise ValueError("Producto no encontrado")
            
            if product.track_stock:
                if adjustment.type == 'exit' and product.current_stock < adjustment.quantity:
                    raise ValueError(f"Stock insuficiente: {product.current_stock}")
                
                if adjustment.type == 'entry':
                    product.current_stock += adjustment.quantity
                elif adjustment.type == 'exit':
                    product.current_stock -= adjustment.quantity
                elif adjustment.type == 'adjustment':
                    product.current_stock = adjustment.quantity
            
            movement = InventoryMovement(
                type=adjustment.type,
                reference_type='product',
                reference_id=adjustment.reference_id,
                quantity=adjustment.quantity if adjustment.type == 'entry' else -adjustment.quantity,
                unit_cost=adjustment.unit_cost,
                reason=adjustment.reason,
                reference=adjustment.reference,
                user_id=user_id,
                notes=adjustment.notes,
            )
            
        elif adjustment.reference_type == 'ingredient':
            ingredient = await self.db.get(Ingredient, adjustment.reference_id)
            if not ingredient:
                raise ValueError("Ingrediente no encontrado")
            
            if adjustment.type == 'entry':
                ingredient.current_stock += adjustment.quantity
            elif adjustment.type == 'exit':
                if ingredient.current_stock < adjustment.quantity:
                    raise ValueError(f"Stock insuficiente: {ingredient.current_stock}")
                ingredient.current_stock -= adjustment.quantity
            elif adjustment.type == 'adjustment':
                ingredient.current_stock = adjustment.quantity
            
            movement = InventoryMovement(
                type=adjustment.type,
                reference_type='ingredient',
                reference_id=adjustment.reference_id,
                quantity=adjustment.quantity if adjustment.type == 'entry' else -adjustment.quantity,
                unit_cost=adjustment.unit_cost,
                reason=adjustment.reason,
                reference=adjustment.reference,
                user_id=user_id,
                notes=adjustment.notes,
            )
        
        else:
            raise ValueError("Tipo de referencia inválido")
        
        self.db.add(movement)
        await self.db.commit()
        await self.db.refresh(movement)
        
        return movement
    
    async def get_product_availability(self, product_id: int) -> Dict[str, Any]:
        """Get real-time availability for a product."""
        product = await self.db.get(Product, product_id)
        if not product:
            return {'available': 0, 'limiting_ingredient': None}
        
        if product.type == 'simple':
            if product.track_stock:
                return {
                    'available': int(product.current_stock),
                    'limiting_ingredient': None,
                }
            return {'available': 999999, 'limiting_ingredient': None}
        
        # Composite product - check recipe ingredients
        if product.recipe_id:
            recipe = await self.db.get(Recipe, product.recipe_id)
            if recipe:
                min_available = 999999
                limiting = None
                
                for ri in recipe.ingredients:
                    ingredient = await self.db.get(Ingredient, ri.ingredient_id)
                    if ingredient:
                        available = int(ingredient.current_stock / ri.quantity)
                        if available < min_available:
                            min_available = available
                            limiting = {
                                'ingredient_id': ingredient.id,
                                'name': ingredient.name,
                                'available': float(ingredient.current_stock),
                                'unit': ingredient.unit,
                            }
                
                return {
                    'available': max(0, min_available),
                    'limiting_ingredient': limiting,
                }
        
        return {'available': 0, 'limiting_ingredient': None}


class InventoryService:
    """Inventory management service."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_low_stock_alerts(self, business_type: str) -> List[Dict[str, Any]]:
        """Get products/ingredients below minimum stock."""
        alerts = []
        
        # Products
        result = await self.db.execute(
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
        if business_type == 'restaurant':
            result = await self.db.execute(
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
    
    async def get_inventory_valuation(self) -> Dict[str, Any]:
        """Calculate total inventory value."""
        # Products value
        product_result = await self.db.execute(
            select(
                func.sum(Product.current_stock * Product.cost).label('total'),
                func.count(Product.id).label('count')
            )
            .where(Product.track_stock == True, Product.is_active == True)
        )
        product_val = product_result.first()
        
        # Ingredients value
        ingredient_result = await self.db.execute(
            select(
                func.sum(Ingredient.current_stock * Ingredient.cost_per_unit).label('total'),
                func.count(Ingredient.id).label('count')
            )
            .where(Ingredient.is_active == True)
        )
        ingredient_val = ingredient_result.first()
        
        total_value = (product_val.total or 0) + (ingredient_val.total or 0)
        
        # By category
        cat_result = await self.db.execute(
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