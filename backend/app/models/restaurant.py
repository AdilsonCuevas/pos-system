# Restaurant Models - Ingredients, Recipes, Modifiers

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Ingredient(Base):
    __tablename__ = "ingredients"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    cost_per_unit: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    current_stock: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0, nullable=False)
    min_stock: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    
    # Relationships
    recipe_ingredients: Mapped[list["RecipeIngredient"]] = relationship(
        back_populates="ingredient",
        lazy="selectin",
    )
    modifiers: Mapped[list["Modifier"]] = relationship(
        back_populates="ingredient",
        lazy="selectin",
    )
    
    __table_args__ = (
        Index("idx_ingredients_active", "is_active"),
    )
    
    def __repr__(self) -> str:
        return f"<Ingredient(id={self.id}, name={self.name}, unit={self.unit})>"


class Recipe(Base):
    __tablename__ = "recipes"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    prep_time_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cook_time_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    yield_quantity: Mapped[Decimal] = mapped_column(Numeric(10, 3), default=1, nullable=False)
    yield_unit: Mapped[str] = mapped_column(String(20), default="porcion", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    
    # Relationships
    product: Mapped["Product"] = relationship(back_populates="recipe", lazy="selectin")
    ingredients: Mapped[list["RecipeIngredient"]] = relationship(
        back_populates="recipe",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    
    def __repr__(self) -> str:
        return f"<Recipe(id={self.id}, product_id={self.product_id}, name={self.name})>"


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    recipe_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("recipes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ingredient_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("ingredients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    is_optional: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Relationships
    recipe: Mapped["Recipe"] = relationship(back_populates="ingredients", lazy="selectin")
    ingredient: Mapped["Ingredient"] = relationship(back_populates="recipe_ingredients", lazy="selectin")
    
    __table_args__ = (
        UniqueConstraint("recipe_id", "ingredient_id", name="uq_recipe_ingredient"),
        Index("idx_recipe_ingredients_recipe", "recipe_id"),
        Index("idx_recipe_ingredients_ingredient", "ingredient_id"),
    )
    
    def __repr__(self) -> str:
        return f"<RecipeIngredient(recipe={self.recipe_id}, ingredient={self.ingredient_id}, qty={self.quantity})>"


class ModifierGroup(Base):
    __tablename__ = "modifier_groups"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    selection_type: Mapped[str] = mapped_column(
        Enum("single", "multiple", name="modifier_selection_enum"),
        nullable=False,
        default="single",
    )
    required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    min_selections: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_selections: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    
    # Relationships
    modifiers: Mapped[list["Modifier"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    products: Mapped[list["ProductModifier"]] = relationship(
        back_populates="group",
        lazy="selectin",
    )
    
    def __repr__(self) -> str:
        return f"<ModifierGroup(id={self.id}, name={self.name})>"


class Modifier(Base):
    __tablename__ = "modifiers"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("modifier_groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    price_delta: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    ingredient_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("ingredients.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    ingredient_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Relationships
    group: Mapped["ModifierGroup"] = relationship(back_populates="modifiers", lazy="selectin")
    ingredient: Mapped[Optional["Ingredient"]] = relationship(lazy="selectin")
    
    __table_args__ = (
        Index("idx_modifiers_group", "group_id"),
        Index("idx_modifiers_ingredient", "ingredient_id"),
    )
    
    def __repr__(self) -> str:
        return f"<Modifier(id={self.id}, group_id={self.group_id}, name={self.name})>"


class ProductModifier(Base):
    __tablename__ = "product_modifiers"
    
    product_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("products.id", ondelete="CASCADE"),
        primary_key=True,
    )
    group_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("modifier_groups.id", ondelete="CASCADE"),
        primary_key=True,
    )
    
    # Relationships
    product: Mapped["Product"] = relationship(back_populates="modifiers", lazy="selectin")
    group: Mapped["ModifierGroup"] = relationship(back_populates="products", lazy="selectin")
    
    def __repr__(self) -> str:
        return f"<ProductModifier(product={self.product_id}, group={self.group_id})>"