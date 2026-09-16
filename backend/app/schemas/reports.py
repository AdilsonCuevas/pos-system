# Reports Schemas

from pydantic import BaseModel, Field
from typing import Optional, List
from decimal import Decimal
from datetime import datetime


class SalesReportRequest(BaseModel):
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    payment_method: Optional[str] = None
    group_by: Optional[str] = Field(None, pattern='^(day|week|month|category|payment_method|user)$')


class SalesReportResponse(BaseModel):
    period: dict
    total_sales: int
    total_revenue: Decimal
    avg_ticket: Decimal
    by_payment_method: List[dict]
    by_category: List[dict]
    by_hour: List[dict]


class InventoryValuationResponse(BaseModel):
    total_value: Decimal
    products_value: Decimal
    ingredients_value: Decimal
    by_category: List[dict]
    top_items: List[dict]
    zero_stock: List[dict]


class RecipeCostAnalysisResponse(BaseModel):
    product_id: int
    product_name: str
    sale_price: Decimal
    recipe_cost: Decimal
    margin_percent: Decimal
    margin_amount: Decimal
    ingredients: List[dict]