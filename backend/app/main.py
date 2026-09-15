# FastAPI Application Entry Point

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
import logging
import time

from app.config import settings
from app.database import init_db, close_db, check_db_connection
from app.api.v1.router import api_router
from app.utils.security import setup_jwt_keys

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("🚀 Starting POS System Backend...")
    
    # Setup JWT keys
    await setup_jwt_keys()
    
    # Initialize database (in production, use Alembic migrations)
    # await init_db()
    
    # Verify DB connection
    if await check_db_connection():
        logger.info("✅ Database connection verified")
    else:
        logger.error("❌ Database connection failed!")
    
    logger.info(f"🌍 Business Type: {settings.BUSINESS_TYPE}")
    logger.info(f"🔐 Auth: JWT {settings.JWT_ALGORITHM} ({settings.ACCESS_TOKEN_EXPIRE_MINUTES}min access)")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down...")
    await close_db()
    logger.info("✅ Shutdown complete")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="POS System API - Inventory & Point of Sale for Grocery & Restaurant",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "X-Page-Count"],
)

# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    process_time = time.perf_counter() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}"
    return response


# Exception Handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation Error",
            "message": "Invalid request data",
            "details": exc.errors(),
        },
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.error(f"Database error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Database Error",
            "message": "An internal database error occurred",
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred",
        },
    )


# Health Check
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for load balancers and monitoring."""
    db_healthy = await check_db_connection()
    return {
        "status": "ok" if db_healthy else "degraded",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "business_type": settings.BUSINESS_TYPE,
        "database": "connected" if db_healthy else "disconnected",
        "timestamp": time.time(),
    }


# Include API Router
app.include_router(api_router, prefix="/api")


# Root
@app.get("/", tags=["Root"])
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs" if settings.DEBUG else "disabled",
        "health": "/health",
    }