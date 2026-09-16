# Test Fixtures

import pytest
import pytest_asyncio
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import AsyncGenerator
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import (
    User, RefreshToken,
    Category, Product, ProductVariant,
    Ingredient, Recipe, RecipeIngredient,
    ModifierGroup, Modifier, ProductModifier,
    Sale, SaleItem,
    InventoryMovement, PurchaseOrder, PurchaseOrderItem, StockCount, StockCountItem,
    FDEDocument, FDENumbering,
    SyncQueue,
)
from app.utils.security import hash_password, create_access_token, create_refresh_token
from app.config import settings


# Test database URL - SQLite in memory for fast tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    import asyncio
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    await engine.dispose()


@pytest.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create database session for each test."""
    async_session = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def client(db_session):
    """Create test client with database session override."""
    from httpx import AsyncClient
    from fastapi.testclient import TestClient
    
    def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    
    app.dependency_overrides.clear()


# ============================================================
# User Fixtures
# ============================================================

@pytest.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """Create admin user."""
    user = User(
        email="admin@test.com",
        password_hash=hash_password("admin123"),
        name="Admin User",
        role="admin",
        business_type="restaurant",
        max_concurrent_sessions=5,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def manager_user(db_session: AsyncSession) -> User:
    """Create manager user."""
    user = User(
        email="manager@test.com",
        password_hash=hash_password("manager123"),
        name="Manager User",
        role="manager",
        business_type="restaurant",
        max_concurrent_sessions=3,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def cashier_user(db_session: AsyncSession) -> User:
    """Create cashier user."""
    user = User(
        email="cashier@test.com",
        password_hash=hash_password("cashier123"),
        name="Cashier User",
        role="cashier",
        business_type="restaurant",
        max_concurrent_sessions=2,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def grocery_cashier(db_session: AsyncSession) -> User:
    """Create grocery store cashier."""
    user = User(
        email="grocery@test.com",
        password_hash=hash_password("grocery123"),
        name="Grocery Cashier",
        role="cashier",
        business_type="grocery",
        max_concurrent_sessions=2,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


# ============================================================
# Auth Fixtures
# ============================================================

@pytest.fixture
def admin_token(admin_user: User) -> str:
    """Create access token for admin user."""
    return create_access_token(
        subject=str(admin_user.id),
        role=admin_user.role,
        business_type=admin_user.business_type,
    )


@pytest.fixture
def manager_token(manager_user: User) -> str:
    """Create access token for manager user."""
    return create_access_token(
        subject=str(manager_user.id),
        role=manager_user.role,
        business_type=manager_user.business_type,
    )


@pytest.fixture
def cashier_token(cashier_user: User) -> str:
    """Create access token for cashier user."""
    return create_access_token(
        subject=str(cashier_user.id),
        role=cashier_user.role,
        business_type=cashier_user.business_type,
    )


@pytest.fixture
def grocery_token(grocery_cashier: User) -> str:
    """Create access token for grocery cashier."""
    return create_access_token(
        subject=str(grocery_cashier.id),
        role=grocery_cashier.role,
        business_type=grocery_cashier.business_type,
    )


@pytest.fixture
def admin_refresh_token(db_session: AsyncSession, admin_user: User):
    """Create refresh token for admin user."""
    token, token_hash = create_refresh_token(str(admin_user.id))
    
    from app.models.user import RefreshToken
    from datetime import timedelta
    
    rt = RefreshToken(
        user_id=admin_user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db_session.add(rt)
    # Note: commit handled by test
    return token


# ============================================================
# Catalog Fixtures
# ============================================================

@pytest.fixture
async def root_category(db_session: AsyncSession) -> Category:
    """Create root category."""
    cat = Category(
        name="Bebidas",
        sort_order=1,
        is_active=True,
    )
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)
    return cat


@pytest.fixture
async def sub_category(db_session: AsyncSession, root_category: Category) -> Category:
    """Create sub-category."""
    cat = Category(
        parent_id=root_category.id,
        name="Gaseosas",
        sort_order=1,
        is_active=True,
    )
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)
    return cat


@pytest.fixture
async def product_simple(db_session: AsyncSession, root_category: Category) -> Product:
    """Create simple product."""
    product = Product(
        sku="COC-350",
        name="Coca Cola 350ml",
        description="Refresco de cola",
        type="simple",
        unit="unidad",
        price=Decimal("3500.00"),
        cost=Decimal("2000.00"),
        tax_rate=Decimal("0.1900"),
        category_id=root_category.id,
        track_stock=True,
        min_stock=Decimal("10"),
        current_stock=Decimal("100"),
        is_active=True,
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product


@pytest.fixture
async def product_composite(db_session: AsyncSession, root_category: Category) -> Product:
    """Create composite product (restaurant)."""
    product = Product(
        sku="HAMB-CLAS",
        name="Hamburguesa Clásica",
        description="Hamburguesa con queso, lechuga, tomate",
        type="composite",
        unit="porcion",
        price=Decimal("15000.00"),
        cost=Decimal("8000.00"),
        tax_rate=Decimal("0.1900"),
        category_id=root_category.id,
        track_stock=False,  # Composite tracks ingredients
        is_active=True,
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product


@pytest.fixture
async def product_variant(db_session: AsyncSession, product_simple: Product) -> ProductVariant:
    """Create product variant."""
    variant = ProductVariant(
        product_id=product_simple.id,
        name="Grande",
        price_delta=Decimal("500.00"),
        sku_suffix="-GR",
        sort_order=1,
    )
    db_session.add(variant)
    await db_session.commit()
    await db_session.refresh(variant)
    return variant


# ============================================================
# Restaurant Fixtures
# ============================================================

@pytest.fixture
async def ingredient(db_session: AsyncSession) -> Ingredient:
    """Create ingredient."""
    ing = Ingredient(
        name="Carne de res",
        unit="g",
        cost_per_unit=Decimal("0.0500"),
        current_stock=Decimal("5000"),
        min_stock=Decimal("1000"),
        is_active=True,
    )
    db_session.add(ing)
    await db_session.commit()
    await db_session.refresh(ing)
    return ing


@pytest.fixture
async def ingredient_bun(db_session: AsyncSession) -> Ingredient:
    """Create bun ingredient."""
    ing = Ingredient(
        name="Pan de hamburguesa",
        unit="unidad",
        cost_per_unit=Decimal("500.00"),
        current_stock=Decimal("100"),
        min_stock=Decimal("20"),
        is_active=True,
    )
    db_session.add(ing)
    await db_session.commit()
    await db_session.refresh(ing)
    return ing


@pytest.fixture
async def ingredient_cheese(db_session: AsyncSession) -> Ingredient:
    """Create cheese ingredient."""
    ing = Ingredient(
        name="Queso cheddar",
        unit="g",
        cost_per_unit=Decimal("0.0800"),
        current_stock=Decimal("2000"),
        min_stock=Decimal("500"),
        is_active=True,
    )
    db_session.add(ing)
    await db_session.commit()
    await db_session.refresh(ing)
    return ing


@pytest.fixture
async def recipe(db_session: AsyncSession, product_composite: Product) -> Recipe:
    """Create recipe for composite product."""
    recipe = Recipe(
        product_id=product_composite.id,
        name="Hamburguesa Clásica",
        instructions="Cocinar carne, tostar pan, armar",
        prep_time_minutes=5,
        cook_time_minutes=10,
        yield_quantity=Decimal("1"),
        yield_unit="porcion",
    )
    db_session.add(recipe)
    await db_session.flush()
    
    # Add recipe ingredients
    from app.models.restaurant import RecipeIngredient
    
    ingredients_data = [
        (1, Decimal("150"), "g"),  # Carne
        (2, Decimal("1"), "unidad"),  # Pan
        (3, Decimal("30"), "g"),  # Queso
    ]
    
    for idx, (ing_id, qty, unit) in enumerate(ingredients_data):
        ri = RecipeIngredient(
            recipe_id=recipe.id,
            ingredient_id=ing_id,
            quantity=qty,
            unit=unit,
            sort_order=idx,
        )
        db_session.add(ri)
    
    await db_session.commit()
    await db_session.refresh(recipe)
    return recipe


@pytest.fixture
async def modifier_group(db_session: AsyncSession) -> ModifierGroup:
    """Create modifier group."""
    mg = ModifierGroup(
        name="Queso",
        selection_type="single",
        required=False,
        min_selections=0,
        max_selections=1,
        sort_order=1,
    )
    db_session.add(mg)
    await db_session.flush()
    return mg


@pytest.fixture
async def modifiers(db_session: AsyncSession, modifier_group: ModifierGroup, ingredient_cheese: Ingredient) -> list[Modifier]:
    """Create modifiers for group."""
    mods = [
        Modifier(
            group_id=modifier_group.id,
            name="Sin queso",
            price_delta=Decimal("0"),
            is_default=True,
            sort_order=1,
        ),
        Modifier(
            group_id=modifier_group.id,
            name="Queso cheddar",
            price_delta=Decimal("1000"),
            ingredient_id=ingredient_cheese.id,
            ingredient_quantity=Decimal("30"),
            is_default=False,
            sort_order=2,
        ),
        Modifier(
            group_id=modifier_group.id,
            name="Queso extra",
            price_delta=Decimal("2000"),
            ingredient_id=ingredient_cheese.id,
            ingredient_quantity=Decimal("60"),
            is_default=False,
            sort_order=3,
        ),
    ]
    
    for mod in mods:
        db_session.add(mod)
    
    await db_session.commit()
    
    for mod in mods:
        await db_session.refresh(mod)
    
    return mods


# ============================================================
# POS Fixtures
# ============================================================

@pytest.fixture
async def sale(db_session: AsyncSession, cashier_user: User, product_simple: Product) -> Sale:
    """Create completed sale."""
    sale = Sale(
        sale_number="POS-20240115-0001",
        user_id=cashier_user.id,
        register_id=1,
        business_type="restaurant",
        status="completed",
        subtotal=Decimal("7000.00"),
        tax_amount=Decimal("1330.00"),
        discount_amount=Decimal("0"),
        total=Decimal("8330.00"),
        change_amount=Decimal("1670.00"),
        payment_method=[
            {"method": "cash", "amount": 10000},
        ],
        synced_at=datetime.now(timezone.utc),
    )
    db_session.add(sale)
    await db_session.flush()
    
    # Add sale item
    item = SaleItem(
        sale_id=sale.id,
        product_id=product_simple.id,
        quantity=Decimal("2"),
        unit_price=Decimal("3500.00"),
        total_price=Decimal("7000.00"),
        modifiers=[],
        sort_order=1,
    )
    db_session.add(item)
    
    await db_session.commit()
    await db_session.refresh(sale)
    return sale


@pytest.fixture
async def sale_with_modifiers(db_session: AsyncSession, cashier_user: User, product_composite: Product, modifiers: list) -> Sale:
    """Create sale with composite product and modifiers."""
    sale = Sale(
        sale_number="POS-20240115-0002",
        user_id=cashier_user.id,
        register_id=1,
        business_type="restaurant",
        status="completed",
        subtotal=Decimal("17000.00"),
        tax_amount=Decimal("3230.00"),
        total=Decimal("20230.00"),
        change_amount=Decimal("0"),
        payment_method=[
            {"method": "card", "amount": 20230},
        ],
        synced_at=datetime.now(timezone.utc),
    )
    db_session.add(sale)
    await db_session.flush()
    
    # Add sale item with modifier
    item = SaleItem(
        sale_id=sale.id,
        product_id=product_composite.id,
        quantity=Decimal("1"),
        unit_price=Decimal("15000.00"),
        total_price=Decimal("17000.00"),
        modifiers=[
            {"group_id": 1, "modifier_id": 3, "name": "Queso extra", "price_delta": "2000"}
        ],
        ingredient_consumption=[
            {"ingredient_id": 1, "quantity": 150, "unit": "g"},
            {"ingredient_id": 2, "quantity": 1, "unit": "unidad"},
            {"ingredient_id": 3, "quantity": 60, "unit": "g"},
        ],
        sort_order=1,
    )
    db_session.add(item)
    
    await db_session.commit()
    await db_session.refresh(sale)
    return sale


# ============================================================
# Inventory Fixtures
# ============================================================

@pytest.fixture
async def inventory_movement(db_session: AsyncSession, product_simple: Product, cashier_user: User) -> InventoryMovement:
    """Create inventory movement."""
    movement = InventoryMovement(
        type="entry",
        reference_type="product",
        reference_id=product_simple.id,
        quantity=Decimal("50"),
        unit_cost=product_simple.cost,
        reason="compra",
        reference="OC-001",
        user_id=cashier_user.id,
    )
    db_session.add(movement)
    await db_session.commit()
    await db_session.refresh(movement)
    return movement


@pytest.fixture
async def purchase_order(db_session: AsyncSession, cashier_user: User, product_simple: Product) -> PurchaseOrder:
    """Create purchase order."""
    from app.models.inventory import PurchaseOrder, PurchaseOrderItem
    
    po = PurchaseOrder(
        po_number="OC-2024001",
        supplier_name="Distribuidora ABC",
        supplier_tax_id="800123456",
        status="received",
        expected_date=date.today(),
        received_date=date.today(),
        total_amount=Decimal("100000.00"),
        created_by=cashier_user.id,
    )
    db_session.add(po)
    await db_session.flush()
    
    item = PurchaseOrderItem(
        po_id=po.id,
        reference_type="product",
        reference_id=product_simple.id,
        quantity=Decimal("50"),
        unit_cost=Decimal("2000.00"),
        received_quantity=Decimal("50"),
    )
    db_session.add(item)
    
    await db_session.commit()
    await db_session.refresh(po)
    return po


# ============================================================
# FDE Fixtures
# ============================================================

@pytest.fixture
async def fde_numbering(db_session: AsyncSession) -> FDENumbering:
    """Create FDE numbering configuration."""
    from datetime import date
    
    num = FDENumbering(
        prefix="POS",
        current_number=0,
        resolution_number="18760000001",
        resolution_date=date(2024, 1, 15),
        valid_from=date(2024, 1, 15),
        valid_until=date(2025, 1, 15),
        range_start=1,
        range_end=999999,
        is_active=True,
    )
    db_session.add(num)
    await db_session.commit()
    await db_session.refresh(num)
    return num


# ============================================================
# Sync Fixtures
# ============================================================

@pytest.fixture
async def sync_queue_item(db_session: AsyncSession) -> SyncQueue:
    """Create sync queue item."""
    from app.models.sync import SyncQueue
    
    item = SyncQueue(
        device_id="test-device-123",
        entity_type="sale",
        entity_id=None,
        operation="create",
        payload={"local_id": "local-123", "total": "10000"},
        status="pending",
        retry_count=0,
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


# ============================================================
# Helper Fixtures
# ============================================================

@pytest.fixture
def auth_headers(admin_token: str) -> dict:
    """Authorization headers for admin."""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def manager_headers(manager_token: str) -> dict:
    """Authorization headers for manager."""
    return {"Authorization": f"Bearer {manager_token}"}


@pytest.fixture
def cashier_headers(cashier_token: str) -> dict:
    """Authorization headers for cashier."""
    return {"Authorization": f"Bearer {cashier_token}"}


@pytest.fixture
def grocery_headers(grocery_token: str) -> dict:
    """Authorization headers for grocery user."""
    return {"Authorization": f"Bearer {grocery_token}"}


# ============================================================
# Sample Data for Testing
# ============================================================

@pytest.fixture
def sample_sale_data() -> dict:
    """Sample sale creation data."""
    return {
        "items": [
            {
                "product_id": 1,
                "quantity": 2,
                "unit_price": 3500.00,
                "modifiers": [],
            }
        ],
        "payments": [
            {"method": "cash", "amount": 10000}
        ],
        "customer": None,
        "notes": "Test sale",
    }


@pytest.fixture
def sample_product_data() -> dict:
    """Sample product creation data."""
    return {
        "sku": "TEST-001",
        "name": "Test Product",
        "type": "simple",
        "unit": "unidad",
        "price": 10000.00,
        "cost": 6000.00,
        "tax_rate": 0.19,
        "category_id": 1,
        "track_stock": True,
        "min_stock": 5,
        "current_stock": 100,
    }


@pytest.fixture
def sample_ingredient_data() -> dict:
    """Sample ingredient creation data."""
    return {
        "name": "Test Ingredient",
        "unit": "g",
        "cost_per_unit": 0.05,
        "current_stock": 1000,
        "min_stock": 100,
    }


# ============================================================
# Cleanup Fixtures
# ============================================================

@pytest.fixture(autouse=True)
async def cleanup_db(db_session: AsyncSession):
    """Clean up database after each test."""
    yield
    # Rollback any pending changes
    await db_session.rollback()