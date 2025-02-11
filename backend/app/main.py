"""
Main application entry point for the Media Asset Management system.
Simple Flask application with Socket.IO for real-time updates.
"""
from flask import Flask
from flask_cors import CORS
import logging
from pathlib import Path
import os
from dotenv import load_dotenv
from .extensions import socketio
from .database import db, init_db

# Load environment variables
load_dotenv()

# Configure logging
LOG_DIR = Path(__file__).parent.parent.parent / 'logs'
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / 'backend.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Initialize Flask
app = Flask(__name__)

# Set basic configuration
app.config['HOST'] = os.getenv('API_HOST', '127.0.0.1')
app.config['PORT'] = int(os.getenv('API_PORT', '5001'))
app.config['DATA_DIR'] = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data')
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{app.config['DATA_DIR']}/merged.db"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Configure CORS
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3001"],
        "supports_credentials": True
    }
})

# Initialize database first
init_db(app)

# Initialize Socket.IO with our app
socketio.init_app(
    app,
    cors_allowed_origins=["http://localhost:3001"],
    logger=True,
    engineio_logger=True,
    async_mode=None,  # Let Socket.IO choose the best async mode
    ping_timeout=5,
    ping_interval=25
)

# Import and initialize health monitoring after database
from .health import init_health
init_health(app)

@socketio.on('connect')
def handle_connect():
    """Handle client connection."""
    logger.info("Client connected")

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection."""
    logger.info("Client disconnected")

# Import routes after app initialization
from .routes import init_app as init_routes

def create_app():
    """Create and configure the Flask application."""
    try:
        # Initialize routes
        init_routes(app)
        logger.info("Application initialized successfully")
        return app
    except Exception as e:
        logger.error(f"Failed to initialize application: {e}")
        raise

def run_app(app):
    """Run the application with Socket.IO support."""
    try:
        host = app.config['HOST']
        port = app.config['PORT']
        
        logger.info(f"Starting server on {host}:{port}")
        socketio.run(
            app,
            host=host,
            port=port,
            debug=True,
            use_reloader=False,
            log_output=True
        )
    except Exception as e:
        logger.error(f"Failed to start server: {e}")
        raise

# Add main entry point
if __name__ == '__main__':
    try:
        app = create_app()
        run_app(app)
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        raise