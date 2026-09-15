# Security Utilities - JWT, Password Hashing, Keys

import os
import base64
import hashlib
import secrets
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Optional
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives.serialization import load_pem_private_key, load_pem_public_key
from jose import jwt, JWTError
from passlib.context import CryptContext
from passlib.hash import argon2

from app.config import settings

# Password hashing
pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")

# RSA Key paths
PRIVATE_KEY_PATH = Path(settings.JWT_PRIVATE_KEY_PATH)
PUBLIC_KEY_PATH = Path(settings.JWT_PUBLIC_KEY_PATH)

# In-memory key cache
_private_key: Optional[rsa.RSAPrivateKey] = None
_public_key: Optional[rsa.RSAPublicKey] = None


async def setup_jwt_keys() -> None:
    """Generate or load RSA keys for JWT signing."""
    global _private_key, _public_key
    
    PRIVATE_KEY_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    if PRIVATE_KEY_PATH.exists() and PUBLIC_KEY_PATH.exists():
        # Load existing keys
        with open(PRIVATE_KEY_PATH, "rb") as f:
            _private_key = load_pem_private_key(f.read(), password=None)
        with open(PUBLIC_KEY_PATH, "rb") as f:
            _public_key = load_pem_public_key(f.read())
        return
    
    # Generate new keys
    _private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    _public_key = _private_key.public_key()
    
    # Save keys
    with open(PRIVATE_KEY_PATH, "wb") as f:
        f.write(_private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ))
    
    with open(PUBLIC_KEY_PATH, "wb") as f:
        f.write(_public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ))
    
    # Set restrictive permissions
    os.chmod(PRIVATE_KEY_PATH, 0o600)
    os.chmod(PUBLIC_KEY_PATH, 0o644)


def get_private_key() -> rsa.RSAPrivateKey:
    if _private_key is None:
        raise RuntimeError("JWT keys not initialized. Call setup_jwt_keys() first.")
    return _private_key


def get_public_key() -> rsa.RSAPublicKey:
    if _public_key is None:
        raise RuntimeError("JWT keys not initialized. Call setup_jwt_keys() first.")
    return _public_key


# -------------------------------------------------------------------------
# Password Hashing
# -------------------------------------------------------------------------

def hash_password(password: str) -> str:
    """Hash password using Argon2."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash."""
    return pwd_context.verify(plain_password, hashed_password)


# -------------------------------------------------------------------------
# JWT Token Management
# -------------------------------------------------------------------------

def create_access_token(
    subject: str,
    role: str,
    business_type: str,
    expires_delta: Optional[timedelta] = None,
    additional_claims: Optional[dict] = None,
) -> str:
    """Create JWT access token."""
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    
    claims = {
        "sub": subject,
        "role": role,
        "business_type": business_type,
        "iat": now,
        "exp": expire,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "type": "access",
    }
    
    if additional_claims:
        claims.update(additional_claims)
    
    private_key = get_private_key()
    private_key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    
    return jwt.encode(claims, private_key_pem, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(
    subject: str,
    expires_delta: Optional[timedelta] = None,
) -> tuple[str, str]:
    """Create opaque refresh token and return (token, token_hash)."""
    # Generate opaque token
    token = secrets.token_urlsafe(32)
    
    # Hash for storage
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    return token, token_hash


def decode_access_token(token: str) -> dict:
    """Decode and validate JWT access token."""
    public_key = get_public_key()
    public_key_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    
    try:
        payload = jwt.decode(
            token,
            public_key_pem,
            algorithms=[settings.JWT_ALGORITHM],
            audience=settings.JWT_AUDIENCE,
            issuer=settings.JWT_ISSUER,
        )
        return payload
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")


def decode_token_unsafe(token: str) -> dict:
    """Decode token without validation (for debugging)."""
    return jwt.get_unverified_claims(token)


# -------------------------------------------------------------------------
# Token Utilities
# -------------------------------------------------------------------------

def get_token_expiry(token: str) -> Optional[datetime]:
    """Get token expiry without full validation."""
    try:
        claims = decode_token_unsafe(token)
        exp = claims.get("exp")
        if exp:
            return datetime.fromtimestamp(exp, tz=timezone.utc)
    except Exception:
        pass
    return None


def is_token_expired(token: str, leeway: int = 0) -> bool:
    """Check if token is expired."""
    expiry = get_token_expiry(token)
    if expiry:
        return datetime.now(timezone.utc) >= expiry - timedelta(seconds=leeway)
    return True


# -------------------------------------------------------------------------
# NIT/CC Validation (Colombia)
# -------------------------------------------------------------------------

def validate_nit(nit: str) -> bool:
    """Validate Colombian NIT (modulo 11)."""
    nit = nit.replace(".", "").replace("-", "").replace(" ", "")
    if not nit.isdigit():
        return False
    
    if len(nit) < 2:
        return False
    
    # Last digit is check digit
    body = nit[:-1]
    check_digit = int(nit[-1])
    
    # Modulo 11 algorithm
    factor = 2
    total = 0
    for digit in reversed(body):
        total += int(digit) * factor
        factor += 1
        if factor > 7:
            factor = 2
    
    remainder = total % 11
    calculated = 11 - remainder
    
    if calculated == 11:
        calculated = 0
    elif calculated == 10:
        calculated = 1
    
    return calculated == check_digit


def validate_cc(cc: str) -> bool:
    """Validate Colombian CC (Cédula de Ciudadanía)."""
    cc = cc.replace(".", "").replace(",", "").replace(" ", "")
    return cc.isdigit() and 7 <= len(cc) <= 10


def format_nit(nit: str) -> str:
    """Format NIT with dots and dash."""
    nit = nit.replace(".", "").replace("-", "").replace(" ", "")
    if len(nit) <= 1:
        return nit
    body = nit[:-1]
    check = nit[-1]
    # Add dots every 3 digits from right
    parts = []
    while len(body) > 3:
        parts.insert(0, body[-3:])
        body = body[:-3]
    if body:
        parts.insert(0, body)
    return ".".join(parts) + "-" + check


# -------------------------------------------------------------------------
# Currency Formatting (COP)
# -------------------------------------------------------------------------

def format_cop(amount: float | int) -> str:
    """Format amount as Colombian Pesos."""
    return f"${amount:,.0f}".replace(",", ".")


def parse_cop(text: str) -> float:
    """Parse COP formatted string to float."""
    return float(text.replace("$", "").replace(".", "").replace(",", ""))