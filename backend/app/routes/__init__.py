"""
API router initialization and request logging.
"""

from flask import Blueprint, request, current_app
import logging
from .media import register_media_routes

# Configure logger
logger = logging.getLogger(__name__)

def init_app(app):
    """Initialize API routes"""
    try:
        # Create main API blueprint
        api = Blueprint('api', __name__, url_prefix='/api/v1')
        
        # Register route modules (health routes are registered separately)
        register_media_routes(api)
        
        # Register request logging
        @api.before_request
        def log_request():
            logger.info(f"Request started: {request.method} {request.path}")
            
        @api.after_request
        def log_response(response):
            logger.info(f"Request completed: {request.method} {request.path} - Status: {response.status_code}")
            return response
            
        # Register blueprint with app
        app.register_blueprint(api)
        logger.info("API routes registered successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize routes: {e}")
        raise
