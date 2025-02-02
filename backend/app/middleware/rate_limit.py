"""Rate limiting for local development - simplified version."""
from functools import wraps

def rate_limit(requests_per_minute=1000):
    """
    Simple rate limiter for local development.
    High limit (1000/min default) since it's local.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # For local dev, just pass through
            return f(*args, **kwargs)
        return decorated_function
    return decorator 