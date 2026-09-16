# POS Schemas - Sales, Cart, Offline

from pydantic import BaseModel, Field
from typing import Optional, List
from decimal import Decimal
from datetime import datetime


# Sale Item
class AppliedModifier(BaseModel):
    group_id: int
    modifier_id: int
    name: str
    price_delta: Decimal = 0


class SaleItemBase(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    quantity: Decimal = Field(..., gt=0)
    unit_price: Decimal = Field(..., ge=0)
    modifiers: List[AppliedModifier] = []
    ingredient_consumption: Optional[List[dict]] = None


class SaleItemCreate(SaleItemBase):
    pass


class SaleItemResponse(SaleItemBase):
    id: int
    sale_id: int
    total_price: Decimal
    product: Optional['ProductResponse'] = None
    variant: Optional['ProductVariantResponse'] = None
    
    class Config:
        from_attributes = True


# Payment
class PaymentMethod(BaseModel):
    method: str = Field(..., pattern='^(cash|card|transfer|other)$')
    amount: Decimal = Field(..., gt=0)
    reference: Optional[str] = None


# Customer for FDE
class FDECustomer(BaseModel):
    tax_id: str = Field(..., pattern='^[0-9]{8,11}$')
    name: str
    email: Optional[str] = Field(None, pattern='^[^@]+@[^@]+\.[^@]+$')
    address: Optional[str] = None
    city: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None


# Sale
class SaleBase(BaseModel):
    items: List[SaleItemCreate] = Field(..., min_length=1)
    payments: List[PaymentMethod] = Field(..., min_length=1)
    customer: Optional[FDECustomer] = None
    notes: Optional[str] = None
    discount_amount: Decimal = Field(default=0, ge=0)


class SaleCreate(SaleBase):
    pass


class OfflineSale(SaleCreate):
    local_id: str  # UUID generated offline
    created_at: datetime
    device_id: str


class SaleResponse(BaseModel):
    id: int
    sale_number: str
    user_id: int
    register_id: int
    business_type: str
    status: str
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total: Decimal
    change_amount: Decimal
    payment_method: List[dict]
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_tax_id: Optional[str] = None
    customer_email: Optional[str] = None
    notes: Optional[str] = None
    synced_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    items: List[SaleItemResponse] = []
    user: Optional['UserResponse'] = None
    fde_document: Optional['FDEDocumentResponse'] = None
    receipt_url: Optional[str] = None
    fde_required: bool = False
    
    class Config:
        from_attributes = True


# Forward reference
ProductResponse = None
ProductVariantResponse = None
UserResponse = None
FDEDocumentResponse = None

SaleItemResponse.model_rebuild()
SaleResponse.model_rebuild()