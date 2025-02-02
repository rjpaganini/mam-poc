"""Centralized error handling for the Media Asset Manager."""
from functools import wraps
from flask import jsonify, current_app
import traceback
from typing import Type, Dict, Any, Optional

class AppError(Exception):
    """Base exception class for application errors."""
    def __init__(self, message: str, status_code: int = 500, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}

class MediaError(AppError):
    """Raised when media file operations fail."""
    pass

class ConfigError(AppError):
    """Raised when configuration is invalid."""
    pass

class DatabaseError(AppError):
    """Raised when database operations fail."""
    pass

def handle_error(error: Exception) -> tuple:
    """
    Central error handler that converts exceptions to JSON responses.
    
    Args:
        error: The exception to handle
        
    Returns:
        Tuple of (response, status_code)
    """
    if isinstance(error, AppError):
        response = {
            "error": error.message,
            "status_code": error.status_code,
            "details": error.details
        }
        status_code = error.status_code
    else:
        # Unexpected error
        current_app.logger.error(f"Unexpected error: {str(error)}", exc_info=True)
        response = {
            "error": "An unexpected error occurred",
            "status_code": 500,
            "details": {
                "type": error.__class__.__name__,
                "message": str(error)
            }
        }
        status_code = 500
        
    if current_app.debug:
        response["debug"] = {
            "traceback": traceback.format_exc(),
            "error_type": error.__class__.__name__
        }
        
    return jsonify(response), status_code

def error_handler(f):
    """Decorator to wrap routes in error handling."""
    @wraps(f)
    def wrapped(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            return handle_error(e)
    return wrapped 