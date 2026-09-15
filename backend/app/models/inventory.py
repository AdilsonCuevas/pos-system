# Inventory Models - Movements, Purchase Orders, Stock Counts

from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
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


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    type: Mapped[str] = mapped_column(
        Enum(
            "entry", "exit", "adjustment", "sale", "refund", "transfer", "count",
            name="movement_type_enum"
        ),
        nullable=False,
        index=True,
    )
    reference_type: Mapped[str] = mapped_column(
        Enum("product", "ingredient", name="reference_type_enum"),
        nullable=False,
    )
    reference_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4), nullable=True)
    reason: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    
    # Relationships
    user: Mapped["User"] = relationship(lazy="selectin")
    
    __table_args__ = (
        Index("idx_inventory_movements_ref", "reference_type", "reference_id"),
        Index("idx_inventory_movements_date", "created_at"),
        Index("idx_inventory_movements_type", "type"),
    )
    
    def __repr__(self) -> str:
        return f"<InventoryMovement(id={self.id}, type={self.type}, ref={self.reference_type}:{self.reference_id})>"


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    po_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    supplier_name: Mapped[str] = mapped_column(String(255), nullable=False)
    supplier_tax_id: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(
        Enum("draft", "sent", "received", "cancelled", name="po_status_enum"),
        nullable=False,
        default="draft",
        index=True,
    )
    expected_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    received_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
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
    creator: Mapped["User"] = relationship(lazy="selectin")
    items: Mapped[list["PurchaseOrderItem"]] = relationship(
        back_populates="po",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    
    __table_args__ = (
        Index("idx_purchase_orders_status", "status"),
    )
    
    def __repr__(self) -> str:
        return f"<PurchaseOrder(id={self.id}, number={self.po_number}, status={self.status})>"


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    po_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("purchase_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reference_type: Mapped[str] = mapped_column(
        Enum("product", "ingredient", name="po_ref_type_enum"),
        nullable=False,
    )
    reference_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    received_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0, nullable=False)
    
    # Relationships
    po: Mapped["PurchaseOrder"] = relationship(back_populates="items", lazy="selectin")
    
    __table_args__ = (
        Index("idx_po_items_po", "po_id"),
        Index("idx_po_items_reference", "reference_type", "reference_id"),
    )
    
    def __repr__(self) -> str:
        return f"<PurchaseOrderItem(id={self.id}, po={self.po_id}, ref={self.reference_type}:{self.reference_id})>"


class StockCount(Base):
    __tablename__ = "stock_counts"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(
        Enum("full", "partial", "cycle", name="count_type_enum"),
        nullable=False,
        default="full",
    )
    status: Mapped[str] = mapped_column(
        Enum("in_progress", "completed", "cancelled", name="count_status_enum"),
        nullable=False,
        default="in_progress",
        index=True,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Relationships
    creator: Mapped["User"] = relationship(lazy="selectin")
    items: Mapped[list["StockCountItem"]] = relationship(
        back_populates="count",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    
    __table_args__ = (
        Index("idx_stock_counts_status", "status"),
    )
    
    def __repr__(self) -> str:
        return f"<StockCount(id={self.id}, name={self.name}, status={self.status})>"


class StockCountItem(Base):
    __tablename__ = "stock_count_items"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    count_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("stock_counts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reference_type: Mapped[str] = mapped_column(
        Enum("product", "ingredient", name="count_ref_type_enum"),
        nullable=False,
    )
    reference_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    expected_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    counted_quantity: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 3), nullable=True)
    variance: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0, nullable=False)
    counted_by: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    counted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    count: Mapped["StockCount"] = relationship(back_populates="items", lazy="selectin")
    counter: Mapped[Optional["User"]] = relationship(lazy="selectin")
    
    __table_args__ = (
        UniqueConstraint("count_id", "reference_type", "reference_id", name="uq_count_item"),
        Index("idx_count_items_count", "count_id"),
    )
    
    def __repr__(self) -> str:
        return f"<StockCountItem(id={self.id}, count={self.count_id}, ref={self.reference_type}:{self.reference_id})>"