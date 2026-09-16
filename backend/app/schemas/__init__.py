# Schemas Package

from app.schemas.catalog import (
    CategoryBase, CategoryCreate, CategoryUpdate, CategoryResponse,
    ProductVariantBase, ProductVariantCreate, ProductVariantResponse,
    ProductBase, ProductCreate, ProductUpdate, ProductResponse,
    IngredientRef,
)

from app.schemas.restaurant import (
    IngredientBase, IngredientCreate, IngredientUpdate, IngredientResponse,
    IngredientAdjustment,
    RecipeIngredientCreate, RecipeIngredientResponse,
    RecipeBase, RecipeCreate, RecipeUpdate, RecipeResponse,
    ModifierBase, ModifierCreate, ModifierResponse,
    ModifierGroupBase, ModifierGroupCreate, ModifierGroupUpdate, ModifierGroupResponse,
)

from app.schemas.pos import (
    AppliedModifier, SaleItemBase, SaleItemCreate, SaleItemResponse,
    PaymentMethod, FDECustomer,
    SaleBase, SaleCreate, OfflineSale, SaleResponse,
)

from app.schemas.inventory import (
    InventoryMovementBase, InventoryMovementCreate, InventoryAdjustment, InventoryMovementResponse,
    PurchaseOrderItemBase, PurchaseOrderItemCreate, PurchaseOrderItemResponse,
    PurchaseOrderBase, PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse,
    StockCountItemBase, StockCountItemCreate, StockCountItemResponse,
    StockCountBase, StockCountCreate, StockCountUpdate, StockCountResponse,
)

from app.schemas.fde import (
    FDECustomer, FDEDocumentCreate, FDEDocumentResponse,
    FDENumberingBase, FDENumberingCreate, FDENumberingUpdate, FDENumberingResponse,
)

from app.schemas.sync import (
    OfflineSale, SyncQueueBase, SyncQueueCreate, SyncQueueResponse,
    SyncBatchRequest, SyncBatchResponse,
)

from app.schemas.auth import (
    LoginRequest, RegisterRequest, RefreshRequest, TokenResponse,
    UserBase, UserCreate, UserUpdate, UserResponse, MeResponse,
)

__all__ = [
    # Catalog
    'CategoryBase', 'CategoryCreate', 'CategoryUpdate', 'CategoryResponse',
    'ProductVariantBase', 'ProductVariantCreate', 'ProductVariantResponse',
    'ProductBase', 'ProductCreate', 'ProductUpdate', 'ProductResponse',
    'IngredientRef',
    # Restaurant
    'IngredientBase', 'IngredientCreate', 'IngredientUpdate', 'IngredientResponse',
    'IngredientAdjustment',
    'RecipeIngredientCreate', 'RecipeIngredientResponse',
    'RecipeBase', 'RecipeCreate', 'RecipeUpdate', 'RecipeResponse',
    'ModifierBase', 'ModifierCreate', 'ModifierResponse',
    'ModifierGroupBase', 'ModifierGroupCreate', 'ModifierGroupUpdate', 'ModifierGroupResponse',
    # POS
    'AppliedModifier', 'SaleItemBase', 'SaleItemCreate', 'SaleItemResponse',
    'PaymentMethod', 'FDECustomer',
    'SaleBase', 'SaleCreate', 'OfflineSale', 'SaleResponse',
    # Inventory
    'InventoryMovementBase', 'InventoryMovementCreate', 'InventoryAdjustment', 'InventoryMovementResponse',
    'PurchaseOrderItemBase', 'PurchaseOrderItemCreate', 'PurchaseOrderItemResponse',
    'PurchaseOrderBase', 'PurchaseOrderCreate', 'PurchaseOrderUpdate', 'PurchaseOrderResponse',
    'StockCountItemBase', 'StockCountItemCreate', 'StockCountItemResponse',
    'StockCountBase', 'StockCountCreate', 'StockCountUpdate', 'StockCountResponse',
    # FDE
    'FDECustomer', 'FDEDocumentCreate', 'FDEDocumentResponse',
    'FDENumberingBase', 'FDENumberingCreate', 'FDENumberingUpdate', 'FDENumberingResponse',
    # Sync
    'OfflineSale', 'SyncQueueBase', 'SyncQueueCreate', 'SyncQueueResponse',
    'SyncBatchRequest', 'SyncBatchResponse',
    # Auth
    'LoginRequest', 'RegisterRequest', 'RefreshRequest', 'TokenResponse',
    'UserBase', 'UserCreate', 'UserUpdate', 'UserResponse', 'MeResponse',
]