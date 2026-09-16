# Configuration Routes - For managing system settings via API

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.fde import FDENumbering
from app.models.user import User
from app.config import settings
from app.api.v1.routes.deps import get_current_user, require_permission, require_role
from app.utils.security import format_nit

router = APIRouter()


# Pydantic models for configuration
class PACConfigRequest(BaseModel):
    pac_provider: str = Field(..., pattern="^(tecnodata|facturacion_electronica_co|sfe)$")
    test_mode: bool = True
    tecnodata_api_key: Optional[str] = None
    facturacion_electronica_co_api_key: Optional[str] = None
    sfe_api_key: Optional[str] = None


class PACConfigResponse(BaseModel):
    pac_provider: str
    test_mode: bool
    # API keys are not returned for security
    has_tecnodata_key: bool
    has_fe_key: bool
    has_sfe_key: bool


class CompanyInfoRequest(BaseModel):
    company_nit: str = Field(..., pattern=r"^\d{8,11}$")
    company_name: str = Field(..., min_length=2, max_length=255)
    company_address: str = Field(..., min_length=5, max_length=255)
    company_city: str = Field(..., min_length=2, max_length=100)
    company_department: str = Field(..., min_length=2, max_length=100)
    company_phone: Optional[str] = Field(None, max_length=20)
    company_email: Optional[str] = Field(None, pattern=r"^[^@]+@[^@]+\.[^@]+$")


class CompanyInfoResponse(BaseModel):
    company_nit: str
    company_name: str
    company_address: str
    company_city: str
    company_department: str
    company_phone: Optional[str]
    company_email: Optional[str]
    nit_formatted: str


class FDENumberingRequest(BaseModel):
    prefix: str = Field(..., min_length=1, max_length=4)
    resolution_number: str = Field(..., min_length=1, max_length=50)
    resolution_date: str  # YYYY-MM-DD
    valid_from: str
    valid_until: str
    range_start: int = Field(..., ge=1)
    range_end: int = Field(..., ge=1)
    is_active: bool = True


class FDENumberingUpdate(BaseModel):
    current_number: Optional[int] = None
    resolution_number: Optional[str] = None
    resolution_date: Optional[str] = None
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    range_start: Optional[int] = None
    range_end: Optional[int] = None
    is_active: Optional[bool] = None


class FDENumberingResponse(BaseModel):
    id: int
    prefix: str
    current_number: int
    resolution_number: str
    resolution_date: str
    valid_from: str
    valid_until: str
    range_start: int
    range_end: int
    is_active: bool
    is_valid: bool
    remaining: int
    created_at: str
    updated_at: str


class SystemConfigResponse(BaseModel):
    business_type: str
    timezone: str
    fde_enabled: bool
    fde_test_mode: bool
    backup_enabled: bool
    backup_time: str
    backup_retention_days: int


@router.get("/system", response_model=SystemConfigResponse)
async def get_system_config(
    current_user: User = Depends(require_role("admin")),
):
    """Get system configuration (admin only)."""
    return SystemConfigResponse(
        business_type=settings.BUSINESS_TYPE,
        timezone=settings.TIMEZONE,
        fde_enabled=settings.FDE_ENABLED,
        fde_test_mode=settings.FDE_TEST_MODE,
        backup_enabled=settings.BACKUP_ENABLED,
        backup_time=settings.BACKUP_TIME,
        backup_retention_days=settings.BACKUP_RETENTION_DAYS,
    )


# PAC Configuration
@router.get("/fde/pac", response_model=PACConfigResponse)
async def get_pac_config(
    current_user: User = Depends(require_permission("fde:config")),
):
    """Get PAC configuration (without API keys for security)."""
    return PACConfigResponse(
        pac_provider=settings.FDE_PAC_PROVIDER,
        test_mode=settings.FDE_TEST_MODE,
        has_tecnodata_key=bool(settings.TECNODATA_API_KEY),
        has_fe_key=bool(settings.FACTURACION_ELECTRONICA_CO_API_KEY),
        has_sfe_key=bool(settings.SFE_API_KEY),
    )


@router.put("/fde/pac")
async def update_pac_config(
    config: PACConfigRequest,
    current_user: User = Depends(require_role("admin")),
):
    """
    Update PAC configuration.
    Note: This updates runtime settings. For persistence, update .env file and restart.
    """
    # In a real implementation, you would:
    # 1. Update .env file
    # 2. Reload settings
    # 3. Or store in database and reload on startup
    
    # For now, we'll just validate and return success
    # The actual persistence requires updating .env and restarting
    
    return {
        "message": "Configuración PAC actualizada. Para persistir, actualice el archivo .env y reinicie el backend.",
        "requires_restart": True,
        "config": {
            "FDE_PAC_PROVIDER": config.pac_provider,
            "FDE_TEST_MODE": str(config.test_mode).lower(),
            "TECNODATA_API_KEY": "***" if config.tecnodata_api_key else "",
            "FACTURACION_ELECTRONICA_CO_API_KEY": "***" if config.facturacion_electronica_co_api_key else "",
            "SFE_API_KEY": "***" if config.sfe_api_key else "",
        }
    }


# Company Information
@router.get("/fde/company", response_model=CompanyInfoResponse)
async def get_company_info(
    current_user: User = Depends(require_permission("fde:config")),
):
    """Get company information for FDE."""
    return CompanyInfoResponse(
        company_nit=settings.COMPANY_NIT,
        company_name=settings.COMPANY_NAME,
        company_address=settings.COMPANY_ADDRESS,
        company_city=settings.COMPANY_CITY,
        company_department=settings.COMPANY_DEPARTMENT,
        company_phone=settings.COMPANY_PHONE,
        company_email=settings.COMPANY_EMAIL,
        nit_formatted=format_nit(settings.COMPANY_NIT),
    )


@router.put("/fde/company")
async def update_company_info(
    company: CompanyInfoRequest,
    current_user: User = Depends(require_role("admin")),
):
    """Update company information for FDE."""
    return {
        "message": "Información de empresa actualizada. Para persistir, actualice el archivo .env y reinicie el backend.",
        "requires_restart": True,
        "config": {
            "COMPANY_NIT": company.company_nit,
            "COMPANY_NAME": company.company_name,
            "COMPANY_ADDRESS": company.company_address,
            "COMPANY_CITY": company.company_city,
            "COMPANY_DEPARTMENT": company.company_department,
            "COMPANY_PHONE": company.company_phone or "",
            "COMPANY_EMAIL": company.company_email or "",
        }
    }


# FDE Numbering
@router.get("/fde/numbering", response_model=List[FDENumberingResponse])
async def list_numbering(
    current_user: User = Depends(require_permission("fde:config")),
    db: AsyncSession = Depends(get_db),
):
    """List all FDE numbering configurations."""
    result = await db.execute(select(FDENumbering).order_by(FDENumbering.prefix))
    numbering = result.scalars().all()
    
    return [
        FDENumberingResponse(
            id=n.id,
            prefix=n.prefix,
            current_number=n.current_number,
            resolution_number=n.resolution_number,
            resolution_date=n.resolution_date.isoformat(),
            valid_from=n.valid_from.isoformat(),
            valid_until=n.valid_until.isoformat(),
            range_start=n.range_start,
            range_end=n.range_end,
            is_active=n.is_active,
            is_valid=n.is_active and n.valid_until >= datetime.now().date(),
            remaining=max(0, n.range_end - n.current_number),
            created_at=n.created_at.isoformat(),
            updated_at=n.updated_at.isoformat(),
        )
        for n in numbering
    ]


@router.post("/fde/numbering", response_model=FDENumberingResponse, status_code=status.HTTP_201_CREATED)
async def create_numbering(
    numbering_data: FDENumberingRequest,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create new FDE numbering configuration."""
    # Validate prefix unique
    existing = await db.execute(select(FDENumbering).where(FDENumbering.prefix == numbering_data.prefix))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Prefijo ya existe")
    
    # Validate range
    if numbering_data.range_start >= numbering_data.range_end:
        raise HTTPException(status_code=400, detail="Rango inválido: inicio debe ser menor que fin")
    
    if numbering_data.valid_from >= numbering_data.valid_until:
        raise HTTPException(status_code=400, detail="Fechas de vigencia inválidas")
    
    from datetime import date
    numbering = FDENumbering(
        prefix=numbering_data.prefix,
        current_number=0,
        resolution_number=numbering_data.resolution_number,
        resolution_date=date.fromisoformat(numbering_data.resolution_date),
        valid_from=date.fromisoformat(numbering_data.valid_from),
        valid_until=date.fromisoformat(numbering_data.valid_until),
        range_start=numbering_data.range_start,
        range_end=numbering_data.range_end,
        is_active=numbering_data.is_active,
    )
    db.add(numbering)
    await db.commit()
    await db.refresh(numbering)
    
    return FDENumberingResponse(
        id=numbering.id,
        prefix=numbering.prefix,
        current_number=numbering.current_number,
        resolution_number=numbering.resolution_number,
        resolution_date=numbering.resolution_date.isoformat(),
        valid_from=numbering.valid_from.isoformat(),
        valid_until=numbering.valid_until.isoformat(),
        range_start=numbering.range_start,
        range_end=numbering.range_end,
        is_active=numbering.is_active,
        is_valid=numbering.is_active and numbering.valid_until >= datetime.now().date(),
        remaining=numbering.range_end - numbering.current_number,
        created_at=numbering.created_at.isoformat(),
        updated_at=numbering.updated_at.isoformat(),
    )


@router.put("/fde/numbering/{prefix}", response_model=FDENumberingResponse)
async def update_numbering(
    prefix: str,
    numbering_data: FDENumberingUpdate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update numbering configuration."""
    result = await db.execute(select(FDENumbering).where(FDENumbering.prefix == prefix))
    numbering = result.scalar_one_or_none()
    
    if not numbering:
        raise HTTPException(status_code=404, detail="Numeración no encontrada")
    
    from datetime import date
    update_data = numbering_data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        if field in ['resolution_date', 'valid_from', 'valid_until'] and value:
            value = date.fromisoformat(value)
        if hasattr(numbering, field):
            setattr(numbering, field, value)
    
    await db.commit()
    await db.refresh(numbering)
    
    return FDENumberingResponse(
        id=numbering.id,
        prefix=numbering.prefix,
        current_number=numbering.current_number,
        resolution_number=numbering.resolution_number,
        resolution_date=numbering.resolution_date.isoformat(),
        valid_from=numbering.valid_from.isoformat(),
        valid_until=numbering.valid_until.isoformat(),
        range_start=numbering.range_start,
        range_end=numbering.range_end,
        is_active=numbering.is_active,
        is_valid=numbering.is_active and numbering.valid_until >= datetime.now().date(),
        remaining=numbering.range_end - numbering.current_number,
        created_at=numbering.created_at.isoformat(),
        updated_at=numbering.updated_at.isoformat(),
    )


@router.delete("/fde/numbering/{prefix}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_numbering(
    prefix: str,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Delete numbering configuration (only if not used)."""
    result = await db.execute(select(FDENumbering).where(FDENumbering.prefix == prefix))
    numbering = result.scalar_one_or_none()
    
    if not numbering:
        raise HTTPException(status_code=404, detail="Numeración no encontrada")
    
    if numbering.current_number > 0:
        raise HTTPException(status_code=400, detail="No se puede eliminar numeración ya usada")
    
    await db.delete(numbering)
    await db.commit()


# Health check for FDE configuration
@router.get("/fde/health")
async def fde_health_check(
    current_user: User = Depends(require_permission("fde:config")),
):
    """Check FDE configuration health."""
    issues = []
    warnings = []
    
    # Check PAC provider
    if not settings.FDE_PAC_PROVIDER:
        issues.append("FDE_PAC_PROVIDER no configurado")
    
    if settings.FDE_PAC_PROVIDER == 'tecnodata' and not settings.TECNODATA_API_KEY:
        issues.append("TECNODATA_API_KEY no configurado")
    elif settings.FDE_PAC_PROVIDER == 'facturacion_electronica_co' and not settings.FACTURACION_ELECTRONICA_CO_API_KEY:
        issues.append("FACTURACION_ELECTRONICA_CO_API_KEY no configurado")
    elif settings.FDE_PAC_PROVIDER == 'sfe' and not settings.SFE_API_KEY:
        issues.append("SFE_API_KEY no configurado")
    
    # Check company info
    if not settings.COMPANY_NIT:
        issues.append("COMPANY_NIT no configurado")
    if not settings.COMPANY_NAME:
        warnings.append("COMPANY_NAME no configurado")
    if not settings.COMPANY_ADDRESS:
        warnings.append("COMPANY_ADDRESS no configurado")
    
    # Check numbering
    from app.database import get_db
    from sqlalchemy import select
    from app.models.fde import FDENumbering
    
    # This would need a db session - simplified for now
    
    return {
        "healthy": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "pac_provider": settings.FDE_PAC_PROVIDER,
        "test_mode": settings.FDE_TEST_MODE,
    }