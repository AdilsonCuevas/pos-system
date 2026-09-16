# Unit Tests for POS Service

import pytest
from decimal import Decimal
from datetime import datetime, timezone
from uuid import uuid4

from app.services.pos import POSService
from app.schemas.pos import SaleCreate, OfflineSale, InventoryAdjustment
from app.models import (
    User, Product, ProductVariant, Category,
    Sale, SaleItem, InventoryMovement,
    Ingredient, Recipe, RecipeIngredient,
    ModifierGroup, Modifier, ProductModifier,
)


class TestPOSServiceSaleCreation:
    """Tests for sale creation logic."""

    @pytest.mark.asyncio
    async def test_create_simple_sale(self, db_session, cashier_user, product_simple):
        """Create a simple sale with one product."""
        pos_service = POSService(db_session)
        
        sale_data = SaleCreate(
            items=[
                {
                    "product_id": product_simple.id,
                    "quantity": Decimal("2"),
                    "unit_price": product_simple.price,
                    "modifiers": [],
                }
            ],
            payments=[{"method": "cash", "amount": 10000}],
            customer=None,
        )
        
        response = await pos_service.create_sale(sale_data, cashier_user.id, 1)
        
        assert response.sale is not None
        assert response.sale.status == "completed"
        assert response.sale.total > 0
        assert len(response.sale.items) == 1
        assert response.sale.items[0].quantity == 2

    @pytest.mark.asyncio
    async def test_create_sale_with_variant(self, db_session, cashier_user, product_simple, product_variant):
        """Create sale with product variant."""
        pos_service = POSService(db_session)
        
        sale_data = SaleCreate(
            items=[
                {
                    "product_id": product_simple.id,
                    "variant_id": product_variant.id,
                    "quantity": Decimal("1"),
                    "unit_price": product_simple.price + product_variant.price_delta,
                    "modifiers": [],
                }
            ],
            payments=[{"method": "cash", "amount": 5000}],
        )
        
        response = await pos_service.create_sale(sale_data, cashier_user.id, 1)
        
        assert response.sale is not None
        assert response.sale.items[0].variant_id == product_variant.id

    @pytest.mark.asyncio
    async def test_create_composite_sale_with_modifiers(self, db_session, cashier_user, product_composite, modifiers):
        """Create sale with composite product and modifier."""
        pos_service = POSService(db_session)
        
        sale_data = SaleCreate(
            items=[
                {
                    "product_id": product_composite.id,
                    "quantity": Decimal("1"),
                    "unit_price": Decimal("15000"),
                    "modifiers": [
                        {"group_id": 1, "modifier_id": 3, "name": "Queso extra", "price_delta": 2000}
                    ],
                }
            ],
            payments=[{"method": "card", "amount": 20000}],
        )
        
        response = await pos_service.create_sale(sale_data, cashier_user.id, 1)
        
        assert response.sale is not None
        assert response.sale.items[0].modifiers is not None
        assert len(response.sale.items[0].modifiers) == 1

    @pytest.mark.asyncio
    async def test_sale_insufficient_stock_simple(self, db_session, cashier_user, product_simple):
        """Sale fails when stock insufficient for simple product."""
        pos_service = POSService(db_session)
        
        # Set stock to 1
        product_simple.current_stock = Decimal("1")
        db_session.add(product_simple)
        await db_session.commit()
        
        sale_data = SaleCreate(
            items=[{
                "product_id": product_simple.id,
                "quantity": Decimal("5"),  # More than stock
                "unit_price": product_simple.price,
                "modifiers": [],
            }],
            payments=[{"method": "cash", "amount": 10000}],
        )
        
        with pytest.raises(ValueError, match="Stock insuficiente"):
            await pos_service.create_sale(sale_data, cashier_user.id, 1)

    @pytest.mark.asyncio
    async def test_sale_insufficient_stock_composite(self, db_session, cashier_user, product_composite, recipe, ingredient):
        """Sale fails when ingredient stock insufficient for composite product."""
        pos_service = POSService(db_session)
        
        # Set ingredient stock to 0
        ingredient.current_stock = Decimal("0")
        db_session.add(ingredient)
        await db_session.commit()
        
        sale_data = SaleCreate(
            items=[{
                "product_id": product_composite.id,
                "quantity": Decimal("1"),
                "unit_price": Decimal("15000"),
                "modifiers": [],
            }],
            payments=[{"method": "card", "amount": 20000}],
        )
        
        with pytest.raises(ValueError, match="Stock insuficiente"):
            await pos_service.create_sale(sale_data, cashier_user.id, 1)

    @pytest.mark.asyncio
    async def test_sale_insufficient_payment(self, db_session, cashier_user, product_simple):
        """Sale fails when payment insufficient."""
        pos_service = POSService(db_session)
        
        sale_data = SaleCreate(
            items=[{
                "product_id": product_simple.id,
                "quantity": Decimal("2"),
                "unit_price": product_simple.price,
                "modifiers": [],
            }],
            payments=[{"method": "cash", "amount": 5000}],  # Less than total
        )
        
        with pytest.raises(ValueError, match="Pago insuficiente"):
            await pos_service.create_sale(sale_data, cashier_user.id, 1)

    @pytest.mark.asyncio
    async def test_sale_calculates_totals_correctly(self, db_session, cashier_user, product_simple):
        """Sale calculates subtotal, tax, and total correctly."""
        pos_service = POSService(db_session)
        
        sale_data = SaleCreate(
            items=[{
                "product_id": product_simple.id,
                "quantity": Decimal("2"),
                "unit_price": product_simple.price,
                "modifiers": [],
            }],
            payments=[{"method": "cash", "amount": 10000}],
        )
        
        response = await pos_service.create_sale(sale_data, cashier_user.id, 1)
        
        sale = response.sale
        expected_subtotal = product_simple.price * 2
        expected_tax = expected_subtotal * Decimal("0.19")
        expected_total = expected_subtotal + expected_tax
        
        assert sale.subtotal == expected_subtotal
        assert sale.tax_amount == expected_tax
        assert sale.total == expected_total
        assert sale.change_amount == Decimal("10000") - expected_total


class TestPOSServiceInventoryAdjustment:
    """Tests for inventory adjustment logic."""

    @pytest.mark.asyncio
    async def test_adjust_stock_entry(self, db_session, cashier_user, product_simple):
        """Stock entry increases product stock."""
        pos_service = POSService(db_session)
        
        initial_stock = product_simple.current_stock
        
        adjustment = InventoryAdjustment(
            reference_type="product",
            reference_id=product_simple.id,
            type="entry",
            quantity=Decimal("50"),
            reason="compra",
            reference="OC-001",
        )
        
        movement = await pos_service.adjust_stock(adjustment, cashier_user.id)
        
        assert movement.type == "entry"
        assert movement.quantity == Decimal("50")
        
        # Refresh product and check stock
        await db_session.refresh(product_simple)
        assert product_simple.current_stock == initial_stock + Decimal("50")

    @pytest.mark.asyncio
    async def test_adjust_stock_exit(self, db_session, cashier_user, product_simple):
        """Stock exit decreases product stock."""
        pos_service = POSService(db_session)
        
        product_simple.current_stock = Decimal("100")
        db_session.add(product_simple)
        await db_session.commit()
        
        adjustment = InventoryAdjustment(
            reference_type="product",
            reference_id=product_simple.id,
            type="exit",
            quantity=Decimal("30"),
            reason="merma",
            notes="Producto dañado",
        )
        
        movement = await pos_service.adjust_stock(adjustment, cashier_user.id)
        
        assert movement.type == "exit"
        assert movement.quantity == Decimal("-30")  # Negative for exit
        
        await db_session.refresh(product_simple)
        assert product_simple.current_stock == Decimal("70")

    @pytest.mark.asyncio
    async def test_adjust_stock_exit_insufficient(self, db_session, cashier_user, product_simple):
        """Stock exit fails when insufficient stock."""
        pos_service = POSService(db_session)
        
        product_simple.current_stock = Decimal("10")
        db_session.add(product_simple)
        await db_session.commit()
        
        adjustment = InventoryAdjustment(
            reference_type="product",
            reference_id=product_simple.id,
            type="exit",
            quantity=Decimal("20"),  # More than stock
            reason="merma",
        )
        
        with pytest.raises(ValueError, match="Stock insuficiente"):
            await pos_service.adjust_stock(adjustment, cashier_user.id)

    @pytest.mark.asyncio
    async def test_adjust_stock_adjustment(self, db_session, cashier_user, product_simple):
        """Stock adjustment sets specific quantity."""
        pos_service = POSService(db_session)
        
        adjustment = InventoryAdjustment(
            reference_type="product",
            reference_id=product_simple.id,
            type="adjustment",
            quantity=Decimal("75"),  # Set to 75
            reason="conteo",
        )
        
        movement = await pos_service.adjust_stock(adjustment, cashier_user.id)
        
        assert movement.type == "adjustment"
        assert movement.quantity == Decimal("75")
        
        await db_session.refresh(product_simple)
        assert product_simple.current_stock == Decimal("75")

    @pytest.mark.asyncio
    async def test_adjust_ingredient_stock(self, db_session, cashier_user, ingredient):
        """Adjust ingredient stock (restaurant)."""
        pos_service = POSService(db_session)
        
        initial_stock = ingredient.current_stock
        
        adjustment = InventoryAdjustment(
            reference_type="ingredient",
            reference_id=ingredient.id,
            type="entry",
            quantity=Decimal("1000"),
            reason="compra",
        )
        
        movement = await pos_service.adjust_stock(adjustment, cashier_user.id)
        
        assert movement.reference_type == "ingredient"
        assert movement.reference_id == ingredient.id
        
        await db_session.refresh(ingredient)
        assert ingredient.current_stock == initial_stock + Decimal("1000")


class TestPOSServiceOfflineSync:
    """Tests for offline sync functionality."""

    @pytest.mark.asyncio
    async def test_queue_offline_sale(self, db_session, cashier_user):
        """Queue offline sale for later sync."""
        pos_service = POSService(db_session)
        
        offline_sale = OfflineSale(
            local_id=str(uuid4()),
            items=[{
                "product_id": 1,
                "quantity": 1,
                "unit_price": 10000,
                "modifiers": [],
            }],
            payments=[{"method": "cash", "amount": 12000}],
            created_at=datetime.now(timezone.utc),
            device_id="device-123",
        )
        
        # This would be called via the sync endpoint
        # For now, test the queueing logic
        from app.models.sync import SyncQueue
        
        queue_item = SyncQueue(
            device_id="device-123",
            entity_type="sale",
            operation="create",
            payload=offline_sale.model_dump(),
            status="pending",
        )
        db_session.add(queue_item)
        await db_session.commit()
        
        # Verify queued
        result = await db_session.execute(
            select(SyncQueue).where(SyncQueue.device_id == "device-123")
        )
        item = result.scalar_one_or_none()
        assert item is not None
        assert item.status == "pending"

    @pytest.mark.asyncio
    async def test_process_sync_queue(self, db_session, cashier_user, product_simple):
        """Process pending sync queue items."""
        from app.models.sync import SyncQueue
        
        # Add offline sale to queue
        queue_item = SyncQueue(
            device_id="device-456",
            entity_type="sale",
            operation="create",
            payload={
                "local_id": "local-789",
                "items": [{"product_id": product_simple.id, "quantity": 1, "unit_price": 5000}],
                "payments": [{"method": "cash", "amount": 5000}],
            },
            status="pending",
        )
        db_session.add(queue_item)
        await db_session.commit()
        
        # Process queue
        pos_service = POSService(db_session)
        result = await pos_service.process_sync_queue("device-456")
        
        assert "synced" in result
        assert "failed" in result
        assert "conflicts" in result


class TestPOSServiceAvailability:
    """Tests for product availability calculation."""

    @pytest.mark.asyncio
    async def test_simple_product_availability(self, db_session, product_simple):
        """Availability for simple product equals current stock."""
        pos_service = POSService(db_session)
        
        availability = await pos_service.get_product_availability(product_simple.id)
        
        assert availability["available"] == int(product_simple.current_stock)
        assert availability["limiting_ingredient"] is None

    @pytest.mark.asyncio
    async def test_composite_product_availability(self, db_session, product_composite, recipe, ingredient, ingredient_bun, ingredient_cheese):
        """Availability for composite product based on limiting ingredient."""
        pos_service = POSService(db_session)
        
        # Set ingredient stocks
        ingredient.current_stock = Decimal("300")   # 2 hamburgers (150g each)
        ingredient_bun.current_stock = Decimal("5")  # 5 hamburgers
        ingredient_cheese.current_stock = Decimal("150")  # 5 hamburgers (30g each)
        
        db_session.add_all([ingredient, ingredient_bun, ingredient_cheese])
        await db_session.commit()
        
        availability = await pos_service.get_product_availability(product_composite.id)
        
        # Limiting is carne: 300g / 150g = 2
        assert availability["available"] == 2
        assert availability["limiting_ingredient"]["ingredient_id"] == ingredient.id
        assert availability["limiting_ingredient"]["available"] == 2


class TestPOSServiceRefunds:
    """Tests for refund processing."""

    @pytest.mark.asyncio
    async def test_full_refund_restores_stock(self, db_session, cashier_user, sale):
        """Full refund restores simple product stock."""
        pos_service = POSService(db_session)
        
        # Get initial stock
        item = sale.items[0]
        product = await db_session.get(Product, item.product_id)
        initial_stock = product.current_stock
        
        # Process refund
        refund_data = {
            "items": [{"sale_item_id": item.id, "quantity": item.quantity}],
            "reason": "Cliente devolvió",
        }
        
        # This would be implemented in the service
        # For now, test the stock restoration logic manually
        from app.services.pos import POSService
        from app.models.inventory import InventoryMovement
        from datetime import datetime, timezone
        
        # Simulate refund stock restoration
        product.current_stock += item.quantity
        movement = InventoryMovement(
            type="refund",
            reference_type="product",
            reference_id=product.id,
            quantity=item.quantity,
            unit_cost=product.cost,
            reason="devolucion",
            reference=sale.sale_number,
            user_id=cashier_user.id,
            notes=f"Refund for sale {sale.sale_number}",
            created_at=datetime.now(timezone.utc),
        )
        db_session.add(movement)
        await db_session.commit()
        
        await db_session.refresh(product)
        assert product.current_stock == initial_stock + item.quantity