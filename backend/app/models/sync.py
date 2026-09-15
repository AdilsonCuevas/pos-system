# Sync Queue Model - Offline Synchronization

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    JSON,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SyncQueue(Base):
    __tablename__ = "sync_queue"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    operation: Mapped[str] = mapped_column(
        Enum("create", "update", "delete", name="sync_operation_enum"),
        nullable=False,
    )
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(
        Enum("pending", "processing", "synced", "failed", "conflict", name="sync_status_enum"),
        nullable=False,
        default="pending",
        index=True,
    )
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    __table_args__ = (
        Index("idx_sync_queue_device_status", "device_id", "status"),
        Index("idx_sync_queue_pending", "status", "created_at"),
    )
    
    def __repr__(self) -> str:
        return f"<SyncQueue(id={self.id}, device={self.device_id}, {self.operation} {self.entity_type})>"