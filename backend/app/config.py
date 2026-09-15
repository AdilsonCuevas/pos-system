# Backend Configuration - Pydantic Settings
# All settings loaded from .env file

from functools import lru_cache
from typing import Literal
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # -------------------------------------------------------------------------
    # Application
    # -------------------------------------------------------------------------
    APP_NAME: str = "POS System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    TIMEZONE: str = "America/Bogota"

    # -------------------------------------------------------------------------
    # Network (set by deploy script)
    # -------------------------------------------------------------------------
    LAN_IP: str = "127.0.0.1"
    LAN_CIDR: str = "192.168.1.0/24"

    # -------------------------------------------------------------------------
    # Database
    # -------------------------------------------------------------------------
    DATABASE_URL: str = Field(
        default="mysql+asyncmy://pos_app:password@localhost:3306/pos_db",
        description="Async SQLAlchemy URL"
    )
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 3600

    # -------------------------------------------------------------------------
    # Authentication (JWT RS256)
    # -------------------------------------------------------------------------
    JWT_SECRET: str = Field(..., min_length=32, description="JWT signing secret (base64)")
    JWT_ALGORITHM: Literal["RS256", "HS256"] = "RS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_ISSUER: str = "pos-system"
    JWT_AUDIENCE: str = "pos-clients"

    # RSA Keys for RS256 (generated on first run if not provided)
    JWT_PRIVATE_KEY_PATH: str = "/app/keys/private.pem"
    JWT_PUBLIC_KEY_PATH: str = "/app/keys/public.pem"

    # -------------------------------------------------------------------------
    # Business Configuration
    # -------------------------------------------------------------------------
    BUSINESS_TYPE: Literal["grocery", "restaurant"] = "restaurant"
    DEFAULT_CURRENCY: str = "COP"
    DEFAULT_TAX_RATE: float = 0.19  # Colombia IVA 19%

    # -------------------------------------------------------------------------
    # FDE (Factura Electrónica DIAN)
    # -------------------------------------------------------------------------
    FDE_ENABLED: bool = True
    FDE_PAC_PROVIDER: Literal["tecnodata", "facturacion_electronica_co", "sfe"] = "tecnodata"
    FDE_TEST_MODE: bool = True
    TECNODATA_API_KEY: str = ""
    FACTURACION_ELECTRONICA_CO_API_KEY: str = ""
    SFE_API_KEY: str = ""
    COMPANY_NIT: str = Field(..., pattern=r"^\d{8,11}$", description="Company NIT without check digit")
    COMPANY_NAME: str = "MI EMPRESA SAS"
    COMPANY_ADDRESS: str = "Calle 123 #45-67"
    COMPANY_CITY: str = "BOGOTA"
    COMPANY_DEPARTMENT: str = "CUNDINAMARCA"
    COMPANY_PHONE: str = "+57 1 2345678"
    COMPANY_EMAIL: str = "facturacion@miempresa.com"

    # -------------------------------------------------------------------------
    # Backup
    # -------------------------------------------------------------------------
    BACKUP_ENABLED: bool = True
    BACKUP_TIME: str = "02:00"
    BACKUP_RETENTION_DAYS: int = 30
    BACKUP_ENCRYPT: bool = False
    BACKUP_ENCRYPT_KEY: str = ""
    RCLONE_REMOTE: str = ""

    # -------------------------------------------------------------------------
    # CORS
    # -------------------------------------------------------------------------
    CORS_ORIGINS: list[str] = Field(
        default_factory=lambda: ["https://pos.local", "https://localhost"],
        description="Allowed CORS origins"
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    # -------------------------------------------------------------------------
    # Rate Limiting
    # -------------------------------------------------------------------------
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60  # seconds

    # -------------------------------------------------------------------------
    # Pagination
    # -------------------------------------------------------------------------
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    # -------------------------------------------------------------------------
    # File Uploads
    # -------------------------------------------------------------------------
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_UPLOAD_TYPES: list[str] = ["image/jpeg", "image/png", "application/pdf"]


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()


# Global settings instance
settings = get_settings()