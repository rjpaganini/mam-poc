# __init__.py - Flask App Factory and Application Initialization

"""
Flask application factory with proper configuration and logging.
Supports WebSocket for real-time updates.
"""

import logging
import os
from pathlib import Path
from datetime import datetime, UTC

# Configure logger
from . import logger
app_logger = logger

# Import socketio instance
from .socket import socketio

# Import database instance
from .database import db

def create_app(config_class=None):
    """Create and configure the Flask application"""
    # Import Flask and extensions here to ensure monkey patching is done first
    from flask import Flask
    from flask_cors import CORS
    from .config import Config
    
    # Initialize Flask app
    app = Flask(__name__)
    
    # Load configuration
    if config_class is None:
        app.config.from_object('app.config.Config')
    else:
        app.config.from_object(config_class)
    
    # Initialize extensions
    CORS(app)
    db.init_app(app)
    socketio.init_app(app)
    
    # Ensure data directory exists
    data_dir = Path(app.config['DATA_DIR'])
    data_dir.mkdir(parents=True, exist_ok=True)
    
    with app.app_context():
        # Ensure database tables exist
        db.create_all()
        app_logger.info(f"Database initialized at {app.config['SQLALCHEMY_DATABASE_URI']}")
        
        # Initialize directories
        if not Config.setup_directories():
            app_logger.error("Failed to setup required directories")
            raise RuntimeError("Directory setup failed")
        
        # Register all routes
        from .routes import register_routes
        register_routes(app)
        
        # Log startup configuration
        app_logger.info(f"Starting MAM server on {app.config['HOST']}:{app.config['PORT']}")
        app_logger.info(f"Media directory: {app.config['MEDIA_PATH']}")
        app_logger.info(f"Data directory: {app.config['DATA_DIR']}")
    
    return app