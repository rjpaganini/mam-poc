"""
Core application setup and configuration.
"""

from flask import Flask
from pathlib import Path
import logging
import asyncio
from typing import Optional
from .metrics import MetricsDB
from .ai.processing_manager import ProcessingManager
from .extensions import db, cors, socketio

# Configure logger
logger = logging.getLogger(__name__)

class FlaskApp(Flask):
    """Extended Flask class with custom attributes"""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.processing_manager: Optional[ProcessingManager] = None
        self.metrics_db: Optional[MetricsDB] = None

def create_app(test_config=None):
    """Create and configure the Flask application"""
    
    # Create Flask app instance
    app = FlaskApp(__name__)
    
    # Load configuration
    if test_config is None:
        app.config.from_object('app.config.Config')
    else:
        app.config.from_object(test_config)
    
    # Initialize extensions with app
    cors.init_app(app)
    db.init_app(app)
    
    # Ensure data directory exists
    data_dir = Path(app.config['DATA_DIR'])
    data_dir.mkdir(parents=True, exist_ok=True)
    
    with app.app_context():
        # Initialize database
        db.create_all()
        logger.info(f"Database initialized at {app.config['SQLALCHEMY_DATABASE_URI']}")
        
        # Initialize metrics database
        app.metrics_db = MetricsDB()
        logger.info("Metrics database initialized")
        
        # Initialize directories
        from .config import Config
        if not Config.setup_directories():
            logger.error("Failed to setup required directories")
            raise RuntimeError("Directory setup failed")
        
        # Initialize processing manager
        app.processing_manager = ProcessingManager()
        logger.info("Processing manager initialized")
        
        # Start processing worker in background
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        # Start processing worker if manager exists
        if app.processing_manager:
            loop.create_task(app.processing_manager.start_processing_worker())
            logger.info("Processing worker started")
        
        # Initialize health monitoring
        from .health import init_health
        init_health(app)
        logger.info("Health monitoring initialized")
        
        # Register routes
        from .routes import register_routes
        register_routes(app)
        
        # Log startup configuration
        logger.info(f"Starting MAM server on {app.config['HOST']}:{app.config['PORT']}")
        logger.info(f"Media directory: {app.config['MEDIA_PATH']}")
        logger.info(f"Data directory: {app.config['DATA_DIR']}")
        logger.info(f"WebSocket mode: {socketio.async_mode}")
    
    return app 