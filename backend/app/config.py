# backend/app/config.py
"""Core configuration for media asset management

Database Structure:
- Location: DATA_DIR/merged.db
- Enhanced schema with:
  - Normalized columns for performance
  - Support for tags and AI processing
  - Rich metadata storage (audio, video, thumbnails)
  - Media directory tracking
"""

import os
from pathlib import Path
from dotenv import load_dotenv
import logging

# Configure logging
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class Config:
    """Base configuration."""
    
    # Get the project root directory
    PROJECT_ROOT = Path(__file__).parent.parent.parent
    
    # Database
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{PROJECT_ROOT}/data/merged.db"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Media storage
    MEDIA_PATH = os.path.join(PROJECT_ROOT, 'media')
    UPLOAD_FOLDER = os.path.join(MEDIA_PATH, 'uploads')
    PROCESSED_FOLDER = os.path.join(MEDIA_PATH, 'processed')
    
    # Ensure directories exist
    for path in [MEDIA_PATH, UPLOAD_FOLDER, PROCESSED_FOLDER]:
        os.makedirs(path, exist_ok=True)
    
    # Flask
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-key-change-in-production')
    DEBUG = True
    TESTING = False
    
    # WebSocket
    CORS_ALLOWED_ORIGINS = "*"
    
    # Create data directory for database
    DATA_DIR = os.path.join(PROJECT_ROOT, 'data')
    os.makedirs(DATA_DIR, exist_ok=True)
    
    # Environment
    ENV = os.getenv('FLASK_ENV', 'development')
    DEBUG = os.getenv('FLASK_DEBUG', '1') == '1'
    
    # Base paths
    BASE_DIR = Path(__file__).parent.parent
    DATA_DIR = Path(os.getenv('DATA_DIR', BASE_DIR.parent/'data')).resolve()
    MEDIA_PATH = Path(os.getenv('MEDIA_PATH', str(BASE_DIR.parent/'media'))).resolve()
    THUMBNAIL_DIR = DATA_DIR/'thumbnails'
    
    # API and WebSocket
    API_PREFIX = '/api/v1'
    HOST = os.getenv('HOST', '0.0.0.0')
    PORT = int(os.getenv('API_PORT', '5001'))
    
    # WebSocket Configuration
    WEBSOCKET_ENABLED = os.getenv('WEBSOCKET_ENABLED', 'true').lower() == 'true'
    WEBSOCKET_PING_INTERVAL = int(os.getenv('WEBSOCKET_PING_INTERVAL', '25000'))
    WEBSOCKET_PING_TIMEOUT = int(os.getenv('WEBSOCKET_PING_TIMEOUT', '5000'))
    
    # CORS Configuration
    CORS_ENABLED = os.getenv('CORS_ENABLED', 'true').lower() == 'true'
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:3001').split(',')
    
    # Media settings
    ALLOWED_EXTENSIONS = {'.mp4', '.mov', '.avi'}
    MAX_FILE_SIZE = 1024 * 1024 * 1024  # 1GB
    
    @classmethod
    def setup_directories(cls) -> bool:
        """Create and verify all required directories"""
        try:
            # Ensure core directories exist
            cls.DATA_DIR.mkdir(parents=True, exist_ok=True)
            cls.THUMBNAIL_DIR.mkdir(parents=True, exist_ok=True)
            
            # Verify media directory exists and is accessible
            if not cls.MEDIA_PATH.exists():
                logger.error(f"Media directory does not exist: {cls.MEDIA_PATH}")
                return False
                
            # Log directory structure for verification
            logger.info("📁 Directory Structure:")
            logger.info(f"├── Data Dir: {cls.DATA_DIR}")
            logger.info(f"│   ├── Database: {cls.DATA_DIR}/merged.db")
            logger.info(f"│   └── Thumbnails: {cls.THUMBNAIL_DIR}")
            logger.info(f"└── Media Dir: {cls.MEDIA_PATH}")
            
            return True
        except Exception as e:
            logger.error(f"Failed to setup directories: {str(e)}")
            return False

    @classmethod
    def validate(cls) -> bool:
        """Validate configuration settings"""
        try:
            # Validate paths
            if not cls.MEDIA_PATH.exists():
                raise ConfigurationError(f"Media path does not exist: {cls.MEDIA_PATH}")
            
            # Validate WebSocket settings
            if cls.WEBSOCKET_ENABLED:
                if cls.WEBSOCKET_PING_INTERVAL <= 0:
                    raise ConfigurationError("Invalid WebSocket ping interval")
                if cls.WEBSOCKET_PING_TIMEOUT <= 0:
                    raise ConfigurationError("Invalid WebSocket ping timeout")
            
            # Validate CORS settings
            if cls.CORS_ENABLED and not cls.CORS_ORIGINS:
                raise ConfigurationError("CORS enabled but no origins specified")
            
            return True
        except Exception as e:
            logger.error(f"Configuration validation failed: {str(e)}")
            return False

class TestConfig(Config):
    """Testing configuration."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"

class ConfigurationError(Exception):
    """Raised when configuration validation fails"""
    pass

# Create config instance
config = Config()