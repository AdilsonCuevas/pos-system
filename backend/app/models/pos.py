# POS Models - Sales, Sale Items, Payments

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List, Any
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
    JSON,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Sale(Base):
    __tablename__ = "sales"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    sale_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    register_id: Mapped[int] = mapped_column(BigInteger, default=1, nullable=False)
    business_type: Mapped[str] = mapped_column(
        Enum("grocery", "restaurant", name="business_type_enum"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        Enum("pending", "completed", "refunded", "voided", name="sale_status_enum"),
        nullable=False,
        default="pending",
        index=True,
    )
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    change_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    payment_method: Mapped[List[dict]] = mapped_column(JSON, nullable=False)
    customer_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    customer_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    customer_tax_id: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    customer_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
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
    user: Mapped["User"] = relationship(lazy="selectin")
    items: Mapped[list["SaleItem"]] = relationship(
        back_populates="sale",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    fde_document: Mapped[Optional["FDEDocument"]] = relationship(
        back_populates="sale",
        lazy="selectin",
    )
    
    __table_args__ = (
        Index("idx_sales_user_date", "user_id", "created_at"),
        Index("idx_sales_status", "status"),
        Index("idx_sales_synced", "synced_at"),
        Index("idx_sales_business_type", "business_type"),
    )
    
    def __repr__(self) -> str:
        return f"<Sale(id={self.id}, number={self.sale_number}, total={self.total})>"


class SaleItem(Base):
    __tablename__ = "sale_items"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    sale_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("sales.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    variant_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("product_variants.id", ondelete="SET NULL"),
        nullable=True,
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    modifiers: Mapped[Optional[List[dict]]] = mapped_column(JSON, nullable=True)
    ingredient_consumption: Mapped[Optional[List[dict]]] = mapped_column(JSON, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Relationships
    sale: Mapped["Sale"] = relationship(back_populates="items", lazy="selectin")
    product: Mapped["Product"] = relationship(lazy="selectin")
    variant: Mapped[Optional["ProductVariant"]] = relationship(lazy="selectin")
    
    __table_args__ = (
        Index("idx_sale_items_sale", "sale_id"),
        Index("idx_sale_items_product", "product_id"),
    )
    
    def __repr__(self) -> str:
        return f"<SaleItem(id={self.id}, sale={self.sale_id}, product={self.product_id}, qty={self.quantity})>"