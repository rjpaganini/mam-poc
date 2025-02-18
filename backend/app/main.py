"""Main entry point for the Media Asset Management backend

This module serves as the primary entry point for both development and production.
Handles application initialization and WebSocket setup.
"""

# Monkey patch must happen before any other imports
import eventlet
eventlet.monkey_patch()

import os
import sys
from flask_socketio import SocketIO
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('logs/backend.log')
    ]
)
logger = logging.getLogger(__name__)

def main():
    """Initialize and run the application with WebSocket support"""
    try:
        # Import app creation after monkey patching
        from app import create_app
        from app.socket import socketio
        
        # Create Flask application instance
        app = create_app()
        
        # Get host and port from environment or use defaults
        host = '0.0.0.0'
        port = int(os.getenv('API_PORT', '5001'))
        
        # Log startup configuration
        logger.info(f"Starting MAM server on {host}:{port}")
        
        # Initialize Socket.IO with app
        socketio.init_app(
            app,
            cors_allowed_origins="*",
            async_mode='eventlet',
            logger=True,
            engineio_logger=True
        )
        logger.info("WebSocket server initialized with eventlet mode")
        
        # Start the application with WebSocket support
        socketio.run(
            app,
            host=host,
            port=port,
            debug=True,
            use_reloader=False,
            log_output=True
        )
    except Exception as e:
        logger.error(f"Failed to start application: {str(e)}", exc_info=True)
        sys.exit(1)

if __name__ == '__main__':
    main()