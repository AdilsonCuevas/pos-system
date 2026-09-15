# FDE Models - Factura Electrónica DIAN

from datetime import datetime, date, timezone
from typing import Optional, List, Any
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
    JSON,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class FDEDocument(Base):
    __tablename__ = "fde_documents"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    sale_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("sales.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
        index=True,
    )
    document_type: Mapped[str] = mapped_column(
        Enum("invoice", "credit_note", "debit_note", "pos_ticket", name="fde_doc_type_enum"),
        nullable=False,
    )
    prefix: Mapped[str] = mapped_column(String(4), nullable=False)
    number: Mapped[int] = mapped_column(BigInteger, nullable=False)
    cufe: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    qr_code: Mapped[str] = mapped_column(Text, nullable=False)
    xml_content: Mapped[str] = mapped_column(Text, nullable=False)
    pdf_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(
        Enum("pending", "authorized", "rejected", "cancelled", name="fde_status_enum"),
        nullable=False,
        default="pending",
        index=True,
    )
    dian_response: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    pac_provider: Mapped[str] = mapped_column(String(50), nullable=False)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    authorized_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    
    # Relationships
    sale: Mapped["Sale"] = relationship(back_populates="fde_document", lazy="selectin")
    
    __table_args__ = (
        UniqueConstraint("prefix", "number", name="uq_fde_prefix_number"),
        Index("idx_fde_documents_status", "status"),
        Index("idx_fde_documents_cufe", "cufe"),
        Index("idx_fde_documents_created", "created_at"),
    )
    
    def __repr__(self) -> str:
        return f"<FDEDocument(id={self.id}, {self.prefix}-{self.number}, status={self.status})>"


class FDENumbering(Base):
    __tablename__ = "fde_numbering"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    prefix: Mapped[str] = mapped_column(String(4), unique=True, nullable=False)
    current_number: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    resolution_number: Mapped[str] = mapped_column(String(50), nullable=False)
    resolution_date: Mapped[date] = mapped_column(Date, nullable=False)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_until: Mapped[date] = mapped_column(Date, nullable=False)
    range_start: Mapped[int] = mapped_column(BigInteger, nullable=False)
    range_end: Mapped[int] = mapped_column(BigInteger, nullable=False)
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
    
    def __repr__(self) -> str:
        return f"<FDENumbering(prefix={self.prefix}, current={self.current_number})>"