"""JSON validation middleware for API endpoints."""
from functools import wraps
from flask import request, current_app
import json

def validate_json(f):
    """Decorator to validate JSON in request body."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not request.is_json:
            current_app.logger.warning("Request content-type is not application/json")
            return {'error': 'Content-Type must be application/json'}, 400
            
        try:
            # Force parsing of the request data as JSON
            if request.get_data():
                json.loads(request.get_data())
            return f(*args, **kwargs)
        except json.JSONDecodeError as e:
            current_app.logger.warning(f"Invalid JSON format: {str(e)}")
            return {'error': 'Invalid JSON format'}, 400
        except Exception as e:
            current_app.logger.error(f"Unexpected error in JSON validation: {str(e)}")
            return {'error': 'Error processing request'}, 400
            
    return decorated_function 