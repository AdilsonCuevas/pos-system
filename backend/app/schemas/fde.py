# FDE Schemas

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from decimal import Decimal
from datetime import datetime, date


class FDECustomer(BaseModel):
    tax_id: str = Field(..., pattern='^[0-9]{8,11}$')
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[str] = Field(None, pattern='^[^@]+@[^@]+\.[^@]+$')
    address: Optional[str] = None
    city: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None


class FDEDocumentCreate(BaseModel):
    sale_id: int
    document_type: str = Field(..., pattern='^(invoice|credit_note|debit_note|pos_ticket)$')
    customer: Optional[FDECustomer] = None


class FDEDocumentResponse(BaseModel):
    id: int
    sale_id: int
    document_type: str
    prefix: str
    number: int
    cufe: str
    qr_code: str
    xml_content: str
    pdf_url: Optional[str] = None
    status: str
    dian_response: Optional[Dict[str, Any]] = None
    pac_provider: str
    sent_at: Optional[datetime] = None
    authorized_at: Optional[datetime] = None
    created_at: datetime
    sale: Optional['SaleResponse'] = None
    
    class Config:
        from_attributes = True


class FDENumberingBase(BaseModel):
    prefix: str = Field(..., min_length=1, max_length=4)
    resolution_number: str = Field(..., min_length=1, max_length=50)
    resolution_date: date
    valid_from: date
    valid_until: date
    range_start: int = Field(..., ge=1)
    range_end: int = Field(..., ge=1)
    is_active: bool = True


class FDENumberingCreate(FDENumberingBase):
    pass


class FDENumberingUpdate(BaseModel):
    current_number: Optional[int] = None
    resolution_number: Optional[str] = None
    resolution_date: Optional[date] = None
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None
    range_start: Optional[int] = None
    range_end: Optional[int] = None
    is_active: Optional[bool] = None


class FDENumberingResponse(FDENumberingBase):
    id: int
    current_number: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True