# __init__.py - Flask App Factory and Application Initialization
# Purpose: Sets up and configures the Flask application using centralized configuration

"""
Flask application factory and initialization.
Handles application setup with proper configuration and error handling.
"""

from flask import Flask
from flask_cors import CORS
from .database import init_db, db
from .config import Config
import logging
import os
from pathlib import Path

# Configure module-level logger
logger = logging.getLogger(__name__)

def create_app(config_class=None) -> Flask:
    """Create and configure Flask application"""
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(config_class or Config)
    
    # Initialize extensions
    CORS(app)
    
    # Ensure data directory exists
    data_dir = Path(app.config['DATA_DIR'])
    data_dir.mkdir(parents=True, exist_ok=True)
    
    # Initialize database with proper context
    db.init_app(app)
    
    with app.app_context():
        # Ensure database tables exist
        db.create_all()
        logger.info(f"Database initialized at {app.config['SQLALCHEMY_DATABASE_URI']}")
        
        # Initialize directories
        if not Config.setup_directories():
            logger.error("Failed to setup required directories")
            raise RuntimeError("Directory setup failed")
        
        # Initialize health monitoring
        from .health import init_health
        init_health(app)
        logger.info("Health monitoring initialized")
        
        # Register core routes
        from .routes import media
        app.register_blueprint(media.api, url_prefix=app.config['API_PREFIX'])
        
        # Log startup configuration
        logger.info(f"Starting MAM server on {app.config['HOST']}:{app.config['PORT']}")
        logger.info(f"Media directory: {app.config['MEDIA_PATH']}")
        logger.info(f"Data directory: {app.config['DATA_DIR']}")
    
    return app