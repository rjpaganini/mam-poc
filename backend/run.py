# run.py
# Development server entry point with WebSocket support
# For production or WebSocket features, use main.py instead

import eventlet
eventlet.monkey_patch()

import os
import sys
from app import create_app, socketio
from app.config import Config
import logging
import warnings

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('logs/backend.log')
    ]
)

logger = logging.getLogger(__name__)

def main():
    """Initialize and run the development server with WebSocket support."""
    try:
        # Display warning about WebSocket limitations
        warnings.warn(
            "\n⚠️  WARNING: Development Server Limitations ⚠️\n"
            "This development server does not fully support WebSockets.\n"
            "For WebSocket features or production use, run using:\n"
            "python -m app.main\n",
            RuntimeWarning
        )
        
        # Verify media directory configuration
        if not Config.MEDIA_PATH.exists():
            logger.error(f"Media directory not found: {Config.MEDIA_PATH}")
            logger.error("Please ensure MEDIA_PATH in .env points to your Google Drive dataset location")
            sys.exit(1)
            
        # Create Flask application instance
        app = create_app()
        
        # Get host and port from environment or use defaults
        host = '0.0.0.0'  # Bind to all interfaces
        port = int(os.getenv('API_PORT', '5001'))
        
        # Log startup configuration
        logger.info(f"Starting MAM development server on {host}:{port}")
        logger.info(f"Media directory: {Config.MEDIA_PATH}")
        logger.info(f"Data directory: {Config.DATA_DIR}")
        logger.info(f"Debug mode: {app.debug}")
        logger.info(f"Environment: {os.getenv('FLASK_ENV', 'development')}")
        logger.info("⚠️  WebSocket features are limited in development server")
        
        # Run the application with Socket.IO support
        socketio.run(app, 
                    host=host, 
                    port=port, 
                    debug=True,
                    use_reloader=False,  # Disable reloader to prevent conflicts
                    log_output=True)  # Enable logging for better debugging
        
    except Exception as e:
        logger.error(f"Failed to start application: {str(e)}", exc_info=True)
        sys.exit(1)

if __name__ == '__main__':
    main() 