# Sync Schemas

from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from decimal import Decimal
from datetime import datetime


class OfflineSale(BaseModel):
    local_id: str  # UUID generated offline
    created_at: datetime
    device_id: str
    items: List[Dict[str, Any]]
    payments: List[Dict[str, Any]]
    customer: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    discount_amount: Decimal = 0


class SyncQueueBase(BaseModel):
    device_id: str
    entity_type: str
    entity_id: Optional[int] = None
    operation: str = Field(..., pattern='^(create|update|delete)$')
    payload: Any
    status: str = Field(default='pending', pattern='^(pending|processing|synced|failed|conflict)$')
    retry_count: int = 0
    last_error: Optional[str] = None


class SyncQueueCreate(SyncQueueBase):
    pass


class SyncQueueResponse(SyncQueueBase):
    id: int
    created_at: datetime
    synced_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class SyncBatchRequest(BaseModel):
    sales: List[OfflineSale]


class SyncBatchResponse(BaseModel):
    synced: List[int] = []  # local IDs
    failed: List[Dict[str, Any]] = []
    conflicts: List[Dict[str, Any]] = []