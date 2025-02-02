"""Basic security headers for local development."""

def security_headers(response):
    """
    Add basic security headers to response.
    Simplified for local development.
    """
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    return response 