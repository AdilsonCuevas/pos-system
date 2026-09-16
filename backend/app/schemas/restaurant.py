# Restaurant Schemas - Ingredients, Recipes, Modifiers

from pydantic import BaseModel, Field
from typing import Optional, List
from decimal import Decimal
from datetime import datetime


# Ingredient
class IngredientBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    unit: str = Field(..., min_length=1, max_length=20)
    cost_per_unit: Decimal = Field(..., gt=0, le=999999.9999)
    current_stock: Decimal = Field(default=0, ge=0)
    min_stock: Decimal = Field(default=0, ge=0)
    is_active: bool = True


class IngredientCreate(IngredientBase):
    pass


class IngredientUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    unit: Optional[str] = Field(None, min_length=1, max_length=20)
    cost_per_unit: Optional[Decimal] = Field(None, gt=0, le=999999.9999)
    current_stock: Optional[Decimal] = Field(None, ge=0)
    min_stock: Optional[Decimal] = Field(None, ge=0)
    is_active: Optional[bool] = None


class IngredientResponse(IngredientBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class IngredientAdjustment(BaseModel):
    type: str = Field(..., pattern='^(entry|exit|adjustment)$')
    quantity: Decimal = Field(..., gt=0)
    unit_cost: Optional[Decimal] = Field(None, ge=0)
    reason: str = Field(..., min_length=1, max_length=100)
    reference: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


# Recipe Ingredient
class RecipeIngredientCreate(BaseModel):
    ingredient_id: int
    quantity: Decimal = Field(..., gt=0)
    unit: str = Field(..., min_length=1, max_length=20)
    is_optional: bool = False
    sort_order: int = 0


class RecipeIngredientResponse(RecipeIngredientCreate):
    id: int
    recipe_id: int
    ingredient: Optional['IngredientResponse'] = None
    
    class Config:
        from_attributes = True


# Recipe
class RecipeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    instructions: Optional[str] = None
    prep_time_minutes: int = Field(default=0, ge=0)
    cook_time_minutes: int = Field(default=0, ge=0)
    yield_quantity: Decimal = Field(default=1, gt=0)
    yield_unit: str = Field(default='porcion', min_length=1, max_length=20)


class RecipeCreate(RecipeBase):
    ingredients: List[RecipeIngredientCreate]


class RecipeUpdate(RecipeBase):
    ingredients: Optional[List[RecipeIngredientCreate]] = None


class RecipeResponse(RecipeBase):
    id: int
    product_id: int
    created_at: datetime
    updated_at: datetime
    ingredients: List[RecipeIngredientResponse] = []
    
    class Config:
        from_attributes = True


# Modifier
class ModifierBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    price_delta: Decimal = Field(default=0, ge=-999999.99, le=999999.99)
    ingredient_id: Optional[int] = None
    ingredient_quantity: Decimal = Field(default=0, ge=0)
    is_default: bool = False
    sort_order: int = 0


class ModifierCreate(ModifierBase):
    pass


class ModifierResponse(ModifierBase):
    id: int
    group_id: int
    ingredient: Optional[IngredientResponse] = None
    
    class Config:
        from_attributes = True


# Modifier Group
class ModifierGroupBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    selection_type: str = Field(default='single', pattern='^(single|multiple)$')
    required: bool = False
    min_selections: int = Field(default=0, ge=0)
    max_selections: int = Field(default=1, ge=1)
    sort_order: int = 0
    is_active: bool = True


class ModifierGroupCreate(ModifierGroupBase):
    modifiers: List[ModifierCreate] = []


class ModifierGroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    selection_type: Optional[str] = Field(None, pattern='^(single|multiple)$')
    required: Optional[bool] = None
    min_selections: Optional[int] = Field(None, ge=0)
    max_selections: Optional[int] = Field(None, ge=1)
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    modifiers: Optional[List[ModifierCreate]] = None


class ModifierGroupResponse(ModifierGroupBase):
    id: int
    created_at: datetime
    modifiers: List[ModifierResponse] = []
    
    class Config:
        from_attributes = True


# Forward reference rebuild
IngredientResponse.model_rebuild()
RecipeIngredientResponse.model_rebuild()
ModifierResponse.model_rebuild()
ModifierGroupResponse.model_rebuild()