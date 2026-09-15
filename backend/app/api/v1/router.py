# API Router v1 - All Routes Registration

from fastapi import APIRouter

from app.api.v1.routes import (
    auth,
    users,
    categories,
    products,
    ingredients,
    recipes,
    modifiers,
    sales,
    inventory,
    fde,
    reports,
    sync,
)

api_router = APIRouter()

# Auth routes (no prefix needed)
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])

# User management
api_router.include_router(users.router, prefix="/users", tags=["Users"])

# Catalog
api_router.include_router(categories.router, prefix="/categories", tags=["Categories"])
api_router.include_router(products.router, prefix="/products", tags=["Products"])

# Restaurant-specific
api_router.include_router(ingredients.router, prefix="/ingredients", tags=["Ingredients"])
api_router.include_router(recipes.router, prefix="/recipes", tags=["Recipes"])
api_router.include_router(modifiers.router, prefix="/modifiers", tags=["Modifiers"])

# POS Core
api_router.include_router(sales.router, prefix="/sales", tags=["Sales"])

# Inventory
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory"])

# FDE (Factura Electrónica)
api_router.include_router(fde.router, prefix="/fde", tags=["FDE"])

# Reports
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])

# Offline Sync
api_router.include_router(sync.router, prefix="/sync", tags=["Sync"])