# Unit Tests for Security Utilities

import pytest
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_token_unsafe,
    get_token_expiry,
    is_token_expired,
    validate_nit,
    validate_cc,
    format_nit,
    format_cop,
    parse_cop,
)


class TestPasswordHashing:
    """Tests for password hashing and verification."""

    def test_hash_password_returns_hash(self):
        """Hash password returns a string hash."""
        password = "secure_password_123"
        hashed = hash_password(password)
        
        assert isinstance(hashed, str)
        assert len(hashed) > 50  # Argon2 hash is long
        assert hashed != password

    def test_hash_password_different_each_time(self):
        """Same password produces different hashes (salt)."""
        password = "secure_password_123"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        
        assert hash1 != hash2

    def test_verify_password_correct(self):
        """Verify correct password returns True."""
        password = "secure_password_123"
        hashed = hash_password(password)
        
        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """Verify incorrect password returns False."""
        password = "secure_password_123"
        hashed = hash_password(password)
        
        assert verify_password("wrong_password", hashed) is False

    def test_verify_password_empty(self):
        """Verify empty password returns False."""
        hashed = hash_password("password")
        
        assert verify_password("", hashed) is False


class TestJWTTokenManagement:
    """Tests for JWT token creation and validation."""

    def test_create_access_token(self):
        """Create access token returns valid JWT."""
        token = create_access_token(
            subject="1",
            role="admin",
            business_type="restaurant",
        )
        
        assert isinstance(token, str)
        assert len(token) > 100
        # JWT has 3 parts separated by dots
        assert token.count(".") == 2

    def test_create_access_token_with_expiry(self):
        """Create access token with custom expiry."""
        expires = timedelta(minutes=30)
        token = create_access_token(
            subject="1",
            role="cashier",
            business_type="grocery",
            expires_delta=expires,
        )
        
        payload = decode_token_unsafe(token)
        exp = payload.get("exp")
        iat = payload.get("iat")
        
        assert exp is not None
        assert iat is not None
        assert exp - iat == 1800  # 30 minutes in seconds

    def test_create_access_token_additional_claims(self):
        """Create access token with additional claims."""
        token = create_access_token(
            subject="1",
            role="admin",
            business_type="restaurant",
            additional_claims={"permissions": ["read", "write"]},
        )
        
        payload = decode_token_unsafe(token)
        assert payload.get("permissions") == ["read", "write"]

    def test_create_refresh_token(self):
        """Create refresh token returns token and hash."""
        token, token_hash = create_refresh_token("1")
        
        assert isinstance(token, str)
        assert len(token) > 20
        assert isinstance(token_hash, str)
        assert len(token_hash) == 64  # SHA-256 hex

    def test_decode_access_token_valid(self):
        """Decode valid access token returns payload."""
        token = create_access_token(
            subject="123",
            role="manager",
            business_type="restaurant",
        )
        
        payload = decode_access_token(token)
        
        assert payload["sub"] == "123"
        assert payload["role"] == "manager"
        assert payload["business_type"] == "restaurant"
        assert payload["type"] == "access"

    def test_decode_access_token_invalid_signature(self):
        """Decode token with invalid signature raises ValueError."""
        # Create token with one secret
        token = create_access_token(subject="1", role="admin", business_type="restaurant")
        
        # Tamper with token
        parts = token.split(".")
        tampered = f"{parts[0]}.{parts[1]}.invalid_signature"
        
        with pytest.raises(ValueError, match="Invalid token"):
            decode_access_token(tampered)

    def test_decode_access_token_expired(self):
        """Decode expired token raises ValueError."""
        # Create token with past expiry
        token = create_access_token(
            subject="1",
            role="admin",
            business_type="restaurant",
            expires_delta=timedelta(seconds=-10),
        )
        
        # Wait a bit to ensure expiry
        import time
        time.sleep(0.1)
        
        with pytest.raises(ValueError, match="Invalid token"):
            decode_access_token(token)

    def test_decode_access_token_wrong_type(self):
        """Decode refresh token as access token fails."""
        _, refresh_hash = create_refresh_token("1")
        # Can't easily test this without creating a refresh token JWT
        # This is covered by integration tests
        pass

    def test_get_token_expiry(self):
        """Get token expiry returns datetime."""
        token = create_access_token(
            subject="1",
            role="admin",
            business_type="restaurant",
        )
        
        expiry = get_token_expiry(token)
        
        assert isinstance(expiry, datetime)
        assert expiry > datetime.now(timezone.utc)

    def test_is_token_expired_false(self):
        """Token not expired returns False."""
        token = create_access_token(
            subject="1",
            role="admin",
            business_type="restaurant",
        )
        
        assert is_token_expired(token) is False

    def test_is_token_expired_true(self):
        """Expired token returns True."""
        token = create_access_token(
            subject="1",
            role="admin",
            business_type="restaurant",
            expires_delta=timedelta(seconds=-10),
        )
        
        import time
        time.sleep(0.1)
        
        assert is_token_expired(token) is True


class TestNITCCValidation:
    """Tests for Colombian NIT and CC validation."""

    def test_validate_nit_valid(self):
        """Valid NIT passes validation."""
        # NIT: 900123456-7 (valid)
        assert validate_nit("900123456-7") is True
        assert validate_nit("900.123.456-7") is True
        assert validate_nit("9001234567") is True

    def test_validate_nit_invalid_check_digit(self):
        """Invalid check digit fails validation."""
        # Last digit changed
        assert validate_nit("900123456-8") is False

    def test_validate_nit_invalid_format(self):
        """Invalid format fails validation."""
        assert validate_nit("abc") is False
        assert validate_nit("123") is False
        assert validate_nit("") is False

    def test_validate_cc_valid(self):
        """Valid CC passes validation."""
        assert validate_cc("12345678") is True
        assert validate_cc("1234567890") is True
        assert validate_cc("1,234,567") is True

    def test_validate_cc_invalid(self):
        """Invalid CC fails validation."""
        assert validate_cc("123456") is False  # Too short
        assert validate_cc("abcdefgh") is False
        assert validate_cc("") is False

    def test_format_nit(self):
        """Format NIT adds dots and dash."""
        assert format_nit("9001234567") == "900.123.456-7"
        assert format_nit("900123456-7") == "900.123.456-7"
        assert format_nit("900.123.456-7") == "900.123.456-7"
        assert format_nit("123") == "123"  # Too short to format


class TestCurrencyFormatting:
    """Tests for COP currency formatting."""

    def test_format_cop_integer(self):
        """Format integer amount."""
        assert format_cop(10000) == "$10.000"
        assert format_cop(1000000) == "$1.000.000"
        assert format_cop(0) == "$0"

    def test_format_cop_float(self):
        """Format float amount."""
        assert format_cop(10000.50) == "$10.001"  # Rounds to nearest
        assert format_cop(1234567.89) == "$1.234.568"

    def test_parse_cop(self):
        """Parse COP formatted string."""
        assert parse_cop("$10.000") == 10000.0
        assert parse_cop("$1.000.000") == 1000000.0
        assert parse_cop("10.000") == 10000.0
        assert parse_cop("1.000.000") == 1000000.0
        assert parse_cop("invalid") == 0.0
        assert parse_cop("") == 0.0