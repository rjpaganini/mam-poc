# __init__.py - Flask App Factory and Application Initialization
# Purpose: Sets up and configures the Flask application using centralized configuration

"""
Flask application factory and initialization.
Handles application setup with proper configuration and error handling.
"""

from flask import Flask, current_app
from flask_cors import CORS
from .routes import init_app as init_routes
from .websocket import init_websocket
from .utils.memory_monitor import MemoryMonitor
from .database import init_db
from .health import init_health
from .config import Config, ConfigurationError
import logging
from typing import Optional
import os

# Configure module-level logger
logger = logging.getLogger(__name__)

def create_app(config_class: Optional[object] = None) -> Flask:
    """
    Create and configure the Flask application.
    
    Args:
        config_class: Optional configuration class to use (defaults to Config)
    
    Returns:
        Flask: Configured Flask application instance
    
    Raises:
        ConfigurationError: If configuration validation fails
    """
    try:
        # Initialize Flask app
        app = Flask(__name__)
        
        # Load configuration
        config_class = config_class or Config
        
        # Import all module-level configuration values
        from .config import (
            API_PREFIX, MEDIA_BASE_PATH, DEBUG, HOST, PORT,
            CORS_ORIGINS, SQLALCHEMY_DATABASE_URI,
            SQLALCHEMY_TRACK_MODIFICATIONS, MEDIA_TYPES,
            SUPPORTED_EXTENSIONS, MEMORY_WARNING_THRESHOLD,
            MEMORY_CRITICAL_THRESHOLD, MEMORY_CHECK_INTERVAL,
            MEDIA_LOCATIONS, BASE_DIR, DATA_DIR
        )
        
        # Update app configuration with module-level values
        app.config.update(
            API_PREFIX=API_PREFIX,
            MEDIA_BASE_PATH=MEDIA_BASE_PATH,
            DEBUG=DEBUG,
            HOST=HOST,
            PORT=PORT,
            CORS_ORIGINS=CORS_ORIGINS,
            SQLALCHEMY_DATABASE_URI=SQLALCHEMY_DATABASE_URI,
            SQLALCHEMY_TRACK_MODIFICATIONS=SQLALCHEMY_TRACK_MODIFICATIONS,
            MEDIA_TYPES=MEDIA_TYPES,
            SUPPORTED_EXTENSIONS=SUPPORTED_EXTENSIONS,
            MEMORY_WARNING_THRESHOLD=MEMORY_WARNING_THRESHOLD,
            MEMORY_CRITICAL_THRESHOLD=MEMORY_CRITICAL_THRESHOLD,
            MEMORY_CHECK_INTERVAL=MEMORY_CHECK_INTERVAL,
            MEDIA_LOCATIONS=MEDIA_LOCATIONS,
            BASE_DIR=BASE_DIR,
            DATA_DIR=DATA_DIR,
            ENV=os.getenv('FLASK_ENV', 'development'),
            WEBSOCKET_PING_INTERVAL=25,
            WEBSOCKET_MAX_MESSAGE_SIZE=1024 * 1024
        )
        
        # Create and validate configuration instance
        if hasattr(config_class, 'validate'):
            config_instance = config_class()
            config_instance.validate()
        
        # Configure CORS with settings from config
        CORS(app, resources={
            r"/*": {
                "origins": app.config['CORS_ORIGINS'],
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "allow_headers": [
                    "Content-Type",
                    "Range",
                    "Authorization",
                    "X-Client-Version",
                    "Upgrade",
                    "Connection",
                    "Sec-WebSocket-Key",
                    "Sec-WebSocket-Version",
                    "Sec-WebSocket-Extensions",
                    "Sec-WebSocket-Protocol"
                ],
                "expose_headers": [
                    "Content-Range",
                    "Accept-Ranges",
                    "Content-Length",
                    "Upgrade",
                    "Connection",
                    "Sec-WebSocket-Accept"
                ],
                "supports_credentials": True,
                "max_age": 3600,  # Cache preflight requests for 1 hour
                "vary_header": True  # Add Vary header for proper caching
            }
        })
        
        # Configure WebSocket server options
        app.config['SOCK_SERVER_OPTIONS'] = {
            'ping_interval': app.config['WEBSOCKET_PING_INTERVAL'],
            'max_message_size': app.config['WEBSOCKET_MAX_MESSAGE_SIZE']
        }
        
        # Initialize core components
        init_components(app)
        
        # Log successful initialization
        logger.info(
            "Application initialized successfully\n"
            f"Environment: {app.config['ENV']}\n"
            f"Debug Mode: {app.config['DEBUG']}\n"
            f"Media Path: {app.config['MEDIA_BASE_PATH']}\n"
            f"API URL: http://{app.config['HOST']}:{app.config['PORT']}{app.config['API_PREFIX']}\n"
            f"Health Check: http://{app.config['HOST']}:{app.config['PORT']}/health"
        )
        
        return app
        
    except ConfigurationError as e:
        logger.error(f"Configuration error during app initialization: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error during app initialization: {str(e)}")
        raise

def init_components(app: Flask) -> None:
    """
    Initialize all application components in the correct order.
    
    Args:
        app: Flask application instance
    """
    try:
        # Initialize database first
        init_db(app)
        
        # Initialize routes after database
        init_routes(app)
        
        # Initialize WebSocket support
        init_websocket(app)
        
        # Initialize health monitoring
        init_health(app)
        
        # Initialize memory monitor last
        app.memory_monitor = MemoryMonitor.get_instance(app)
        app.memory_monitor.start()
        
    except Exception as e:
        logger.error(f"Failed to initialize components: {str(e)}")
        raise