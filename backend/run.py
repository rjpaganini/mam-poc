# run.py
# Main entry point for the Flask application with proper error handling and logging

import os
from app import create_app
import logging

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('app.log')
    ]
)

logger = logging.getLogger(__name__)

def main():
    """Initialize and run the application."""
    try:
        # Create Flask application instance
        app = create_app()
        
        # Get host and port from environment or use defaults
        host = os.getenv('API_HOST', '127.0.0.1')
        port = int(os.getenv('API_PORT', '5001'))
        
        # Log startup configuration
        logger.info(f"Starting server on {host}:{port}")
        logger.info(f"Debug mode: {app.debug}")
        logger.info(f"Environment: {os.getenv('FLASK_ENV', 'development')}")
        
        # Run the application
        app.run(
            host=host,
            port=port,
            debug=True,  # Enable debug mode for development
            use_reloader=True  # Enable auto-reload on code changes
        )
    except Exception as e:
        logger.error(f"Failed to start application: {str(e)}", exc_info=True)
        raise

if __name__ == '__main__':
    main() 