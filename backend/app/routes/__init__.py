"""
API router initialization and request logging.
"""

from flask import Blueprint, request, current_app
import logging
from . import media, processing, metrics  # Import metrics routes

# Configure logger
logger = logging.getLogger(__name__)

def register_routes(app):
    """Initialize API routes"""
    try:
        # Register request logging
        @app.before_request
        def log_request():
            logger.info(f"Request started: {request.method} {request.path}")
            
        @app.after_request
        def log_response(response):
            logger.info(f"Request completed: {request.method} {request.path} - Status: {response.status_code}")
            return response
        
        # Register blueprints with /api/v1 prefix
        app.register_blueprint(media.api, url_prefix='/api/v1')
        app.register_blueprint(processing.api, url_prefix='/api/v1')
        app.register_blueprint(metrics.metrics_api, url_prefix='/api/v1')
            
        logger.info("API routes registered successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize routes: {e}")
        raise
