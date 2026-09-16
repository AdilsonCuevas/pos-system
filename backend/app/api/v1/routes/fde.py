# FDE (Factura Electrónica) Routes

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, timezone

from app.database import get_db
from app.models.fde import FDEDocument, FDENumbering
from app.models.pos import Sale
from app.models.user import User
from app.schemas.fde import FDEDocumentCreate, FDEDocumentResponse, FDENumberingCreate, FDENumberingResponse
from app.services.fde.factory import get_pac_provider
from app.services.fde.numbering import get_next_number
from app.api.v1.routes.deps import get_current_user, require_permission, require_role, PaginationParams
from app.models.fde import FDEDocument as FDEDocumentModel

router = APIRouter()


@router.post("/documents", response_model=FDEDocumentResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_fde_document(
    doc_data: FDEDocumentCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_permission("fde:write")),
    db: AsyncSession = Depends(get_db),
):
    """Request FDE authorization for a sale (async)."""
    sale = await db.get(Sale, doc_data.sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    
    if sale.fde_document:
        raise HTTPException(status_code=400, detail="Venta ya tiene documento FDE")
    
    # Get next number for document type
    numbering = await get_next_number(db, doc_data.document_type)
    if not numbering:
        raise HTTPException(status_code=400, detail=f"Numeración no configurada para {doc_data.document_type}")
    
    # Create document record
    document = FDEDocument(
        sale_id=sale.id,
        document_type=doc_data.document_type,
        prefix=numbering.prefix,
        number=numbering.current_number + 1,
        cufe="",  # Will be filled after authorization
        qr_code="",
        xml_content="",  # Will be filled after authorization
        status="pending",
        pac_provider=numbering.pac_provider,
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)
    
    # Process async
    background_tasks.add_task(process_fde_authorization, document.id, doc_data.customer)
    
    return FDEDocumentResponse(**document.__dict__)


async def process_fde_authorization(document_id: int, customer: Optional[dict]):
    """Background task to process FDE authorization."""
    # This would be implemented with proper session management
    # For now, placeholder
    pass


@router.get("/documents", response_model=List[FDEDocumentResponse])
async def list_fde_documents(
    status: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(require_permission("fde:read")),
    db: AsyncSession = Depends(get_db),
):
    """List FDE documents with filters."""
    query = select(FDEDocument).options(selectinload(FDEDocument.sale).selectinload(Sale.user))
    
    if status:
        query = query.where(FDEDocument.status == status)
    if from_date:
        query = query.where(FDEDocument.created_at >= from_date)
    if to_date:
        query = query.where(FDEDocument.created_at <= to_date)
    
    query = query.order_by(FDEDocument.created_at.desc()).offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(query)
    documents = result.scalars().all()
    
    return documents


@router.get("/documents/{document_id}", response_model=FDEDocumentResponse)
async def get_fde_document(
    document_id: int,
    current_user: User = Depends(require_permission("fde:read")),
    db: AsyncSession = Depends(get_db),
):
    """Get single FDE document."""
    result = await db.execute(
        select(FDEDocument).options(selectinload(FDEDocument.sale)).where(FDEDocument.id == document_id)
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(status_code=404, detail="Documento FDE no encontrado")
    
    return document


@router.get("/documents/{document_id}/status")
async def check_fde_status(
    document_id: int,
    current_user: User = Depends(require_permission("fde:read")),
    db: AsyncSession = Depends(get_db),
):
    """Check FDE document status with DIAN."""
    result = await db.execute(
        select(FDEDocument).where(FDEDocument.id == document_id)
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(status_code=404, detail="Documento FDE no encontrado")
    
    if document.status != 'pending':
        return document
    
    # Check with PAC provider
    pac = get_pac_provider()
    result = await pac.check_status(document.cufe)
    
    if result.success:
        document.status = 'authorized'
        document.authorized_at = datetime.now(timezone.utc)
        document.dian_response = result.dian_response
        await db.commit()
    
    return document


@router.post("/documents/{document_id}/cancel", status_code=200)
async def cancel_fde_document(
    document_id: int,
    reason: str,
    current_user: User = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Cancel authorized FDE document (issue credit note)."""
    result = await db.execute(
        select(FDEDocument).where(FDEDocument.id == document_id)
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(status_code=404, detail="Documento FDE no encontrado")
    
    if document.status != 'authorized':
        raise HTTPException(status_code=400, detail="Solo se pueden anular documentos autorizados")
    
    pac = get_pac_provider()
    cancel_result = await pac.cancel_document(document.cufe, reason)
    
    if cancel_result.success:
        document.status = 'cancelled'
        document.dian_response = cancel_result.dian_response
        await db.commit()
        return {"message": "Documento anulado correctamente"}
    else:
        raise HTTPException(status_code=500, detail=f"Error al anular: {cancel_result.error}")


# Numbering Routes
@router.get("/numbering", response_model=List[FDENumberingResponse])
async def list_numbering(
    current_user: User = Depends(require_permission("fde:config")),
    db: AsyncSession = Depends(get_db),
):
    """List FDE numbering configurations."""
    from app.models.fde import FDENumbering
    from sqlalchemy import select
    
    result = await db.execute(select(FDENumbering).order_by(FDENumbering.prefix))
    numbering = result.scalars().all()
    return numbering


@router.post("/numbering", response_model=FDENumberingResponse, status_code=status.HTTP_201_CREATED)
async def create_numbering(
    numbering_data: FDENumberingCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create new numbering configuration."""
    from app.models.fde import FDENumbering
    
    # Validate prefix unique
    existing = await db.execute(select(FDENumbering).where(FDENumbering.prefix == numbering_data.prefix))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Prefijo ya existe")
    
    # Validate range
    if numbering_data.range_start >= numbering_data.range_end:
        raise HTTPException(status_code=400, detail="Rango inválido")
    
    if numbering_data.valid_from >= numbering_data.valid_until:
        raise HTTPException(status_code=400, detail="Fechas de vigencia inválidas")
    
    numbering = FDENumbering(**numbering_data.model_dump())
    db.add(numbering)
    await db.commit()
    await db.refresh(numbering)
    return numbering


@router.put("/numbering/{prefix}", response_model=FDENumberingResponse)
async def update_numbering(
    prefix: str,
    numbering_data: dict,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update numbering configuration."""
    from app.models.fde import FDENumbering
    from sqlalchemy import select
    
    result = await db.execute(select(FDENumbering).where(FDENumbering.prefix == prefix))
    numbering = result.scalar_one_or_none()
    
    if not numbering:
        raise HTTPException(status_code=404, detail="Numeración no encontrada")
    
    for field, value in numbering_data.items():
        if hasattr(numbering, field):
            setattr(numbering, field, value)
    
    await db.commit()
    await db.refresh(numbering)
    return numbering


@router.delete("/numbering/{prefix}", status_code=204)
async def delete_numbering(
    prefix: str,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Delete numbering configuration."""
    from app.models.fde import FDENumbering
    from sqlalchemy import select
    
    result = await db.execute(select(FDENumbering).where(FDENumbering.prefix == prefix))
    numbering = result.scalar_one_or_none()
    
    if not numbering:
        raise HTTPException(status_code=404, detail="Numeración no encontrada")
    
    # Check if used
    if numbering.current_number > 0:
        raise HTTPException(status_code=400, detail="No se puede eliminar numeración ya usada")
    
    await db.delete(numbering)
    await db.commit()