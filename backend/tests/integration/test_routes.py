# Integration Tests for API Routes

import pytest
from decimal import Decimal
from datetime import date

from app.models import User, Category, Product, ProductVariant, Ingredient, Recipe, RecipeIngredient


class TestAuthRoutes:
    """Integration tests for authentication endpoints."""

    @pytest.mark.asyncio
    async def test_login_success(self, client, cashier_user):
        """Successful login returns tokens."""
        response = await client.post("/api/auth/login", json={
            "email": "cashier@test.com",
            "password": "cashier123",
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "cashier@test.com"
        assert data["user"]["role"] == "cashier"

    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self, client):
        """Login with invalid credentials fails."""
        response = await client.post("/api/auth/login", json={
            "email": "cashier@test.com",
            "password": "wrong_password",
        })
        
        assert response.status_code == 401
        assert "Credenciales inválidas" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client):
        """Login with nonexistent user fails."""
        response = await client.post("/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "password123",
        })
        
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_token_success(self, client, cashier_user, db_session):
        """Refresh token returns new access token."""
        from app.utils.security import create_refresh_token
        from app.models.user import RefreshToken
        from datetime import datetime, timezone, timedelta
        
        # Create refresh token
        token, token_hash = create_refresh_token(str(cashier_user.id))
        rt = RefreshToken(
            user_id=cashier_user.id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
        db_session.add(rt)
        await db_session.commit()
        
        response = await client.post("/api/auth/refresh", json={
            "refresh_token": token,
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["refresh_token"] != token  # Rotated

    @pytest.mark.asyncio
    async def test_refresh_token_reuse_detected(self, client, cashier_user, db_session):
        """Reusing refresh token revokes all sessions."""
        from app.utils.security import create_refresh_token
        from app.models.user import RefreshToken
        from datetime import datetime, timezone, timedelta
        
        # Create refresh token
        token, token_hash = create_refresh_token(str(cashier_user.id))
        rt = RefreshToken(
            user_id=cashier_user.id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
        db_session.add(rt)
        await db_session.commit()
        
        # First use - should succeed
        response1 = await client.post("/api/auth/refresh", json={"refresh_token": token})
        assert response1.status_code == 200
        
        # Second use with same token - should fail
        response2 = await client.post("/api/auth/refresh", json={"refresh_token": token})
        assert response2.status_code == 401
        assert "reutilizado" in response2.json()["detail"]

    @pytest.mark.asyncio
    async def test_register_first_admin(self, client, db_session):
        """Register first admin user."""
        response = await client.post("/api/auth/register", json={
            "email": "newadmin@test.com",
            "password": "admin123456",
            "name": "New Admin",
            "business_type": "grocery",
        })
        
        assert response.status_code == 201
        data = response.json()
        assert data["user"]["role"] == "admin"
        assert data["user"]["business_type"] == "grocery"

    @pytest.mark.asyncio
    async def test_register_fails_when_users_exist(self, client, cashier_user):
        """Register fails when users already exist."""
        response = await client.post("/api/auth/register", json={
            "email": "another@test.com",
            "password": "password123",
            "name": "Another",
            "business_type": "restaurant",
        })
        
        assert response.status_code == 403


class TestCategoryRoutes:
    """Integration tests for category endpoints."""

    @pytest.mark.asyncio
    async def test_create_category(self, client, auth_headers):
        """Create new category."""
        response = await client.post("/api/categories", json={
            "name": "Nueva Categoría",
            "sort_order": 10,
        }, headers=auth_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Nueva Categoría"
        assert data["is_active"] is True

    @pytest.mark.asyncio
    async def test_create_category_duplicate_name(self, client, auth_headers, root_category):
        """Create category with duplicate name fails."""
        response = await client.post("/api/categories", json={
            "name": "Bebidas",  # Already exists
        }, headers=auth_headers)
        
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_get_category_tree(self, client, auth_headers, root_category, sub_category):
        """Get category tree structure."""
        response = await client.get("/api/categories/tree", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        root = next(c for c in data if c["id"] == root_category.id)
        assert len(root["children"]) >= 1

    @pytest.mark.asyncio
    async def test_update_category(self, client, auth_headers, root_category):
        """Update category."""
        response = await client.put(f"/api/categories/{root_category.id}", json={
            "name": "Bebidas Actualizado",
            "sort_order": 5,
        }, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Bebidas Actualizado"

    @pytest.mark.asyncio
    async def test_delete_category_with_products(self, client, auth_headers, root_category, product_simple):
        """Delete category with products deactivates it."""
        response = await client.delete(f"/api/categories/{root_category.id}", headers=auth_headers)
        
        assert response.status_code == 204


class TestProductRoutes:
    """Integration tests for product endpoints."""

    @pytest.mark.asyncio
    async def test_create_simple_product(self, client, auth_headers, root_category):
        """Create simple product."""
        response = await client.post("/api/products", json={
            "sku": "NEW-001",
            "name": "Nuevo Producto",
            "type": "simple",
            "unit": "unidad",
            "price": 5000,
            "cost": 3000,
            "tax_rate": 0.19,
            "category_id": root_category.id,
            "track_stock": True,
            "min_stock": 5,
        }, headers=auth_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["sku"] == "NEW-001"
        assert data["type"] == "simple"

    @pytest.mark.asyncio
    async def test_create_composite_product(self, client, auth_headers, root_category):
        """Create composite product (restaurant)."""
        # Need restaurant business type
        response = await client.post("/api/products", json={
            "sku": "COMBO-001",
            "name": "Combo Especial",
            "type": "composite",
            "unit": "porcion",
            "price": 25000,
            "cost": 15000,
            "tax_rate": 0.19,
            "category_id": root_category.id,
            "track_stock": False,
        }, headers=auth_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["type"] == "composite"

    @pytest.mark.asyncio
    async def test_create_product_duplicate_sku(self, client, auth_headers, product_simple):
        """Create product with duplicate SKU fails."""
        response = await client.post("/api/products", json={
            "sku": product_simple.sku,  # Duplicate
            "name": "Otro Producto",
            "type": "simple",
            "unit": "unidad",
            "price": 1000,
            "category_id": 1,
        }, headers=auth_headers)
        
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_get_product_availability_simple(self, client, auth_headers, product_simple):
        """Get availability for simple product."""
        response = await client.get(f"/api/products/{product_simple.id}/availability", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "available" in data
        assert data["available"] >= 0

    @pytest.mark.asyncio
    async def test_get_product_availability_composite(self, client, auth_headers, product_composite, recipe, ingredient):
        """Get availability for composite product."""
        response = await client.get(f"/api/products/{product_composite.id}/availability", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "available" in data
        assert "limiting_ingredient" in data

    @pytest.mark.asyncio
    async def test_create_product_variant(self, client, auth_headers, product_simple):
        """Create product variant."""
        response = await client.post(f"/api/products/{product_simple.id}/variants", json={
            "name": "Grande",
            "price_delta": 1000,
            "sku_suffix": "-GR",
        }, headers=auth_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Grande"
        assert data["price_delta"] == 1000


class TestIngredientRoutes:
    """Integration tests for ingredient endpoints (restaurant only)."""

    @pytest.mark.asyncio
    async def test_create_ingredient(self, client, auth_headers):
        """Create ingredient (restaurant only)."""
        response = await client.post("/api/ingredients", json={
            "name": "Tomate",
            "unit": "g",
            "cost_per_unit": 0.02,
            "current_stock": 1000,
            "min_stock": 100,
        }, headers=auth_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Tomate"
        assert data["unit"] == "g"

    @pytest.mark.asyncio
    async def test_create_ingredient_grocery_forbidden(self, client, grocery_headers):
        """Create ingredient fails for grocery business type."""
        response = await client.post("/api/ingredients", json={
            "name": "Tomate",
            "unit": "g",
            "cost_per_unit": 0.02,
        }, headers=grocery_headers)
        
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_adjust_ingredient_stock(self, client, auth_headers, ingredient):
        """Adjust ingredient stock."""
        initial_stock = ingredient.current_stock
        
        response = await client.post(f"/api/ingredients/{ingredient.id}/adjust", json={
            "type": "entry",
            "quantity": 500,
            "reason": "compra",
        }, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["current_stock"] == ingredient.current_stock + 500


class TestRecipeRoutes:
    """Integration tests for recipe endpoints."""

    @pytest.mark.asyncio
    async def test_create_recipe(self, client, auth_headers, product_composite, ingredient, ingredient_bun):
        """Create recipe for composite product."""
        response = await client.put(f"/api/recipes/product/{product_composite.id}", json={
            "ingredients": [
                {"ingredient_id": ingredient.id, "quantity": 150, "unit": "g"},
                {"ingredient_id": 2, "quantity": 1, "unit": "unidad"},
            ]
        }, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["product_id"] == 2
        assert len(data["ingredients"]) == 2

    @pytest.mark.asyncio
    async def test_update_recipe(self, client, auth_headers, recipe, ingredient_cheese):
        """Update existing recipe."""
        response = await client.put(f"/api/recipes/product/{recipe.product_id}", json={
            "ingredients": [
                {"ingredient_id": 1, "quantity": 200, "unit": "g"},
                {"ingredient_id": 3, "quantity": 50, "unit": "g"},
            ]
        }, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["ingredients"]) == 2

    @pytest.mark.asyncio
    async def test_create_recipe_grocery_forbidden(self, client, grocery_headers, product_simple):
        """Create recipe fails for grocery business type."""
        response = await client.put(f"/api/recipes/product/{product_simple.id}", json={
            "ingredients": [{"ingredient_id": 1, "quantity": 100, "unit": "g"}]
        }, headers=grocery_headers)
        
        assert response.status_code == 403


class TestModifierRoutes:
    """Integration tests for modifier endpoints."""

    @pytest.mark.asyncio
    async def test_create_modifier_group(self, client, auth_headers):
        """Create modifier group."""
        response = await client.post("/api/modifiers/groups", json={
            "name": "Término de cocción",
            "selection_type": "single",
            "required": True,
            "modifiers": [
                {"name": "Poco", "price_delta": 0},
                {"name": "Medio", "price_delta": 0},
                {"name": "Bien", "price_delta": 0},
            ]
        }, headers=auth_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Término de cocción"
        assert data["selection_type"] == "single"
        assert len(data["modifiers"]) == 3

    @pytest.mark.asyncio
    async def test_assign_modifiers_to_product(self, client, auth_headers, product_composite, modifier_group):
        """Assign modifier group to product."""
        response = await client.post(f"/api/products/{product_composite.id}/modifiers", json={
            "group_ids": [modifier_group.id]
        }, headers=auth_headers)
        
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_create_modifier_group_grocery_forbidden(self, client, grocery_headers):
        """Create modifier group fails for grocery business type."""
        response = await client.post("/api/modifiers/groups", json={
            "name": "Test",
            "modifiers": [{"name": "Opt1"}]
        }, headers=grocery_headers)
        
        assert response.status_code == 403


class TestSaleRoutes:
    """Integration tests for sale endpoints."""

    @pytest.mark.asyncio
    async def test_create_sale_online(self, client, cashier_headers, product_simple):
        """Create online sale."""
        response = await client.post("/api/sales", json={
            "items": [{
                "product_id": product_simple.id,
                "quantity": 2,
                "unit_price": 3500,
            }],
            "payments": [{"method": "cash", "amount": 10000}],
        }, headers=cashier_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "completed"
        assert data["total"] > 0
        assert len(data["items"]) == 1

    @pytest.mark.asyncio
    async def test_create_sale_with_customer(self, client, cashier_headers, product_simple):
        """Create sale with customer for FDE."""
        response = await client.post("/api/sales", json={
            "items": [{"product_id": 1, "quantity": 1, "unit_price": 5000}],
            "payments": [{"method": "cash", "amount": 6000}],
            "customer": {
                "tax_id": "900123456",
                "name": "Cliente Test",
                "email": "cliente@test.com",
                "address": "Calle 123",
                "city": "BOGOTA",
                "department": "CUNDINAMARCA",
            },
        }, headers=cashier_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["customer_tax_id"] == "900123456"

    @pytest.mark.asyncio
    async def test_sync_offline_sales(self, client, cashier_headers, product_simple):
        """Sync offline sales batch."""
        response = await client.post("/api/sales/sync", json={
            "sales": [{
                "local_id": "local-123",
                "items": [{
                    "product_id": 1,
                    "quantity": 1,
                    "unit_price": 5000,
                }],
                "payments": [{"method": "cash", "amount": 6000}],
                "created_at": "2024-01-15T10:00:00Z",
                "device_id": "device-123",
            }]
        }, headers=cashier_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "synced" in data
        assert len(data["synced"]) == 1

    @pytest.mark.asyncio
    async def test_get_sale_receipt(self, client, cashier_headers, sale):
        """Get sale receipt in ESC/POS format."""
        response = await client.get(f"/api/sales/{sale.id}/receipt?format=escpos", headers=cashier_headers)
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/octet-stream"

    @pytest.mark.asyncio
    async def test_refund_sale(self, client, auth_headers, sale):
        """Process refund (manager/admin only)."""
        response = await client.post(f"/api/sales/{sale.id}/refund", json={
            "items": [{"sale_item_id": sale.items[0].id, "quantity": 1}],
            "reason": "Producto defectuoso",
        }, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "refunded"


class TestInventoryRoutes:
    """Integration tests for inventory endpoints."""

    @pytest.mark.asyncio
    async def test_create_inventory_adjustment(self, client, cashier_headers, product_simple):
        """Create inventory adjustment."""
        response = await client.post("/api/inventory/adjustments", json={
            "reference_type": "product",
            "reference_id": product_simple.id,
            "type": "entry",
            "quantity": 50,
            "reason": "compra",
            "reference": "OC-123",
        }, headers=cashier_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["type"] == "entry"
        assert data["quantity"] == 50

    @pytest.mark.asyncio
    async def test_adjustment_insufficient_stock(self client, cashier_headers, product_simple):
        """Exit adjustment fails with insufficient stock."""
        product_simple.current_stock = Decimal("5")
        # This would require DB update, simplified for test
        
        response = await client.post("/api/inventory/adjustments", json={
            "reference_type": "product",
            "reference_id": product_simple.id,
            "type": "exit",
            "quantity": 100,  # More than stock
            "reason": "merma",
        }, headers=cashier_headers)
        
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_low_stock_report(self, client, auth_headers, product_simple):
        """Get low stock report."""
        product_simple.current_stock = Decimal("2")
        product_simple.min_stock = Decimal("5")
        # Simplified - would need DB update
        
        response = await client.get("/api/reports/inventory/low-stock", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestFDERoutes:
    """Integration tests for FDE endpoints."""

    @pytest.mark.asyncio
    async def test_request_fde_authorization(self, client, cashier_headers, sale, fde_numbering):
        """Request FDE authorization for sale."""
        response = await client.post("/api/fde/documents", json={
            "sale_id": sale.id,
            "document_type": "pos_ticket",
            "customer": None,
        }, headers=cashier_headers)
        
        assert response.status_code == 202
        data = response.json()
        assert data["status"] == "pending"
        assert "document_id" in data

    @pytest.mark.asyncio
    async def test_request_fde_with_customer(self, client, cashier_headers, sale, fde_numbering):
        """Request FDE with customer data for invoice."""
        response = await client.post("/api/fde/documents", json={
            "sale_id": sale.id,
            "document_type": "invoice",
            "customer": {
                "tax_id": "900123456",
                "name": "Cliente Test",
                "email": "cliente@test.com",
                "address": "Calle 123",
                "city": "BOGOTA",
                "department": "CUNDINAMARCA",
            },
        }, headers=cashier_headers)
        
        assert response.status_code == 202

    @pytest.mark.asyncio
    async def test_list_fde_documents(self, client, cashier_headers):
        """List FDE documents."""
        response = await client.get("/api/fde/documents", headers=cashier_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_check_fde_status(self, client, cashier_headers, fde_document):
        """Check FDE document status."""
        response = await client.get(f"/api/fde/documents/{fde_document.id}/status", headers=cashier_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "status" in data

    @pytest.mark.asyncio
    async def test_list_numbering(self, client, auth_headers, fde_numbering):
        """List FDE numbering configurations."""
        response = await client.get("/api/config/fde/numbering", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    @pytest.mark.asyncio
    async def test_create_numbering(self, client, auth_headers):
        """Create new numbering configuration."""
        response = await client.post("/api/config/fde/numbering", json={
            "prefix": "FAC",
            "resolution_number": "18760000002",
            "resolution_date": "2024-01-15",
            "valid_from": "2024-01-15",
            "valid_until": "2025-01-15",
            "range_start": 1,
            "range_end: 999999,
        }, headers=auth_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["prefix"] == "FAC"


class TestSyncRoutes:
    """Integration tests for offline sync endpoints."""

    @pytest.mark.asyncio
    async def test_queue_offline_sale(self, client, cashier_headers):
        """Queue offline sale for later sync."""
        response = await client.post("/api/sync/sales", json={
            "local_id": "local-abc-123",
            "items": [{"product_id": 1, "quantity": 1, "unit_price": 5000}],
            "payments": [{"method": "cash", "amount": 6000}],
            "created_at": "2024-01-15T10:00:00Z",
            "device_id": "device-789",
        }, headers=cashier_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "queued"

    @pytest.mark.asyncio
    async def test_process_sync_queue(self, client, cashier_headers):
        """Process pending sync queue."""
        response = await client.post("/api/sync/process", headers=cashier_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "synced" in data
        assert "failed" in data
        assert "conflicts" in data


class TestConfigRoutes:
    """Integration tests for configuration endpoints."""

    @pytest.mark.asyncio
    async def test_get_pac_config(self, client, auth_headers):
        """Get PAC configuration."""
        response = await client.get("/api/config/fde/pac", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "pac_provider" in data
        assert "test_mode" in data

    @pytest.mark.asyncio
    async def test_update_pac_config(self, client, auth_headers):
        """Update PAC configuration (requires restart)."""
        response = await client.put("/api/config/fde/pac", json={
            "pac_provider": "tecnodata",
            "test_mode": True,
            "tecnodata_api_key": "new_key_123",
        }, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["requires_restart"] is True

    @pytest.mark.asyncio
    async def test_get_company_info(self, client, auth_headers):
        """Get company information."""
        response = await client.get("/api/config/fde/company", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "company_nit" in data
        assert "nit_formatted" in data

    @pytest.mark.asyncio
    async def test_fde_health_check(self, client, auth_headers):
        """FDE health check."""
        response = await client.get("/api/config/fde/health", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "healthy" in data
        assert "issues" in data
        assert "warnings" in data


class TestUserRoutes:
    """Integration tests for user management."""

    @pytest.mark.asyncio
    async def test_list_users(self, client, auth_headers):
        """List users."""
        response = await client.get("/api/users", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_create_user_admin_only(self, client, auth_headers):
        """Create user (admin only)."""
        response = await client.post("/api/users", json={
            "email": "newuser@test.com",
            "password": "password123",
            "name": "New User",
            "role": "cashier",
            "business_type": "restaurant",
        }, headers=auth_headers)
        
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_cashier_cannot_create_user(self, client, cashier_headers):
        """Cashier cannot create users."""
        response = await client.post("/api/users", json={
            "email": "newuser@test.com",
            "password": "password123",
            "name": "New User",
            "role": "cashier",
        }, headers=cashier_headers)
        
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_revoke_user_sessions(self, client, auth_headers, cashier_user):
        """Admin revokes user sessions."""
        response = await client.post(f"/api/users/{cashier_user.id}/revoke-sessions", headers=auth_headers)
        
        assert response.status_code == 200