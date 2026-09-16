# Backend Dockerfile - FastAPI + Python 3.11
# Multi-stage build for smaller production image

# =============================================================================
# Base Stage
# =============================================================================
FROM python:3.11-slim as base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libmariadb-dev \
    pkg-config \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# =============================================================================
# Builder Stage - Install dependencies using pip directly
# =============================================================================
FROM base as builder

# Install pip tools
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Install dependencies directly with pip (bypassing poetry lock issues)
RUN pip install --no-cache-dir \
    fastapi==0.111.0 \
    uvicorn[standard]==0.30.1 \
    sqlalchemy==2.0.30 \
    asyncmy==0.2.7 \
    alembic==1.12.1 \
    pydantic==2.7.4 \
    pydantic-settings==2.3.3 \
    pydantic-extra-types==2.7.0 \
    python-jose[cryptography]==3.3.0 \
    passlib[argon2]==1.7.4 \
    bcrypt==4.1.2 \
    httpx==0.27.0 \
    python-multipart==0.0.9 \
    email-validator==2.1.0 \
    python-dateutil==2.9.0 \
    pytz==2024.1 \
    lxml==4.9.3 \
    xmlschema==3.2.0 \
    xmlsec==1.3.14 \
    arq==0.26.0 \
    redis==4.6.0

# =============================================================================
# Development Stage
# =============================================================================
FROM builder as development

# Install dev dependencies
RUN pip install --no-cache-dir \
    pytest==8.2.1 \
    pytest-asyncio==0.23.3 \
    pytest-cov==4.1.0 \
    pytest-mock==3.14.0 \
    factory-boy==3.3.0 \
    faker==27.2.0 \
    testcontainers==4.6.0 \
    ruff==0.4.4 \
    mypy==1.10.0 \
    pre-commit==3.7.1 \
    ipython==8.25.0 \
    debugpy==1.8.1

# Copy source code
COPY --chown=appuser:appuser . .

USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# =============================================================================
# Production Stage
# =============================================================================
FROM base as production

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY --chown=appuser:appuser . .

# Create uploads directory
RUN mkdir -p /app/uploads && chown appuser:appuser /app/uploads

USER appuser

EXPOSE 8000

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]