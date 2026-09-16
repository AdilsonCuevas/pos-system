# Catalog Schemas - Pydantic v2

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from decimal import Decimal
from datetime import datetime


# Category
class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    parent_id: Optional[int] = None
    sort_order: int = 0
    is_active: bool = True


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(CategoryBase):
    name: Optional[str] = Field(None, min_length=1, max_length=255)


class CategoryResponse(CategoryBase):
    id: int
    created_at: datetime
    updated_at: datetime
    children: List['CategoryResponse'] = []
    
    class Config:
        from_attributes = True


# Product Variant
class ProductVariantBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    price_delta: Decimal = Field(default=0, ge=-999999.99, le=999999.99)
    sku_suffix: Optional[str] = Field(None, max_length=20)
    sort_order: int = 0


class ProductVariantCreate(ProductVariantBase):
    pass


class ProductVariantResponse(ProductVariantBase):
    id: int
    product_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# Product
class ProductBase(BaseModel):
    sku: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    type: str = Field(default='simple', pattern='^(simple|composite)$')
    unit: str = Field(..., min_length=1, max_length=20)
    price: Decimal = Field(..., ge=0, le=999999.99)
    cost: Decimal = Field(default=0, ge=0, le=999999.99)
    tax_rate: Decimal = Field(default=0.1900, ge=0, le=1)
    category_id: int
    track_stock: bool = True
    min_stock: Decimal = Field(default=0, ge=0)
    current_stock: Decimal = Field(default=0, ge=0)
    recipe_id: Optional[int] = None
    image_url: Optional[str] = Field(None, max_length=500)
    is_active: bool = True
    sort_order: int = 0


class ProductCreate(ProductBase):
    variants: Optional[List[ProductVariantCreate]] = None


class ProductUpdate(BaseModel):
    sku: Optional[str] = Field(None, min_length=1, max_length=100)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    type: Optional[str] = Field(None, pattern='^(simple|composite)$')
    unit: Optional[str] = Field(None, min_length=1, max_length=20)
    price: Optional[Decimal] = Field(None, ge=0, le=999999.99)
    cost: Optional[Decimal] = Field(None, ge=0, le=999999.99)
    tax_rate: Optional[Decimal] = Field(None, ge=0, le=1)
    category_id: Optional[int] = None
    track_stock: Optional[bool] = None
    min_stock: Optional[Decimal] = Field(None, ge=0)
    current_stock: Optional[Decimal] = Field(None, ge=0)
    recipe_id: Optional[int] = None
    image_url: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    variants: Optional[List[ProductVariantCreate]] = None


class ProductResponse(ProductBase):
    id: int
    created_at: datetime
    updated_at: datetime
    category: Optional['CategoryResponse'] = None
    variants: List[ProductVariantResponse] = []
    available: Optional[int] = None
    limiting_ingredient: Optional['IngredientRef'] = None
    
    class Config:
        from_attributes = True


class IngredientRef(BaseModel):
    ingredient_id: int
    name: str
    available: float
    unit: str


# Forward references
CategoryResponse.model_rebuild()
ProductResponse.model_rebuild()