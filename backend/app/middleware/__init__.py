"""Middleware package for local development."""
from .auth import require_auth, generate_token
from .rate_limit import rate_limit
from .validation import validate_json
from .security import security_headers

# Simple JSON validation middleware for local dev
def validate_json_middleware():
    """Pass-through JSON validation for local development."""
    return None

__all__ = [
    'require_auth',
    'rate_limit',
    'validate_json',
    'generate_token',
    'security_headers',
    'validate_json_middleware'
]
