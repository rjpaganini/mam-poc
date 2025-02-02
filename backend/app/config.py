# backend/app/config.py
# Central configuration management for the application
# Handles environment variables, paths, and validation with proper error messages

import os
from pathlib import Path
from dotenv import load_dotenv
import logging
from typing import Dict, Set, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Default paths
BASE_DIR = Path(__file__).parent.parent.resolve()
DATA_DIR = Path(os.getenv('DATA_DIR', os.path.join(os.path.dirname(BASE_DIR), 'data')))

# Google Drive path as the single source of truth (expanded for clarity)
DEFAULT_MEDIA_PATH = os.path.expanduser("~/Library/CloudStorage/GoogleDrive-rjpaganini@gmail.com/My Drive/Business/Valen Media/valn.io/exploration/valn.io/Data/Raw_Videos")

# Set environment variable if not already set
if not os.getenv('MEDIA_BASE_PATH'):
    os.environ['MEDIA_BASE_PATH'] = DEFAULT_MEDIA_PATH

# Initialize memory monitoring configuration
MEMORY_WARNING_THRESHOLD = float(os.getenv('MEMORY_WARNING_THRESHOLD', '75.0'))
MEMORY_CRITICAL_THRESHOLD = float(os.getenv('MEMORY_CRITICAL_THRESHOLD', '90.0'))
MEMORY_CHECK_INTERVAL = int(os.getenv('MEMORY_CHECK_INTERVAL', '60'))

# Initialize media locations
MEDIA_LOCATIONS = {
    'default': {
        'path': DEFAULT_MEDIA_PATH,  # Use default path directly
        'description': 'Google Drive media storage location'
    }
}

# Initialize default values for commonly used configuration
API_PREFIX = os.getenv('API_PREFIX', '/api/v1')
MEDIA_BASE_PATH = Path(DEFAULT_MEDIA_PATH).expanduser().resolve()  # Use default path directly
DEBUG = os.getenv('FLASK_ENV', 'development') == 'development'
HOST = os.getenv('API_HOST', '127.0.0.1')
PORT = int(os.getenv('API_PORT', '5001'))
CORS_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:5001',
    'http://127.0.0.1:5001',
]
SQLALCHEMY_DATABASE_URI = f'sqlite:///{DATA_DIR}/mam.db'
SQLALCHEMY_TRACK_MODIFICATIONS = False
MEDIA_TYPES = {
    'video': {
        'extensions': {'.mp4', '.mov', '.avi', '.mkv'},
        'max_size': int(os.getenv('MAX_VIDEO_SIZE', str(10 * 1024 * 1024 * 1024))),
    },
    'image': {
        'extensions': {'.jpg', '.jpeg', '.png', '.gif'},
        'max_size': int(os.getenv('MAX_IMAGE_SIZE', str(1 * 1024 * 1024 * 1024))),
    }
}
SUPPORTED_EXTENSIONS = {ext for type_config in MEDIA_TYPES.values() for ext in type_config['extensions']}

class ConfigurationError(Exception):
    """Custom exception for configuration-related errors."""
    pass

class Config:
    """Central configuration class with validation and error handling."""
    
    def __init__(self):
        """Initialize configuration with environment variables and validation."""
        # Essential paths
        self.BASE_DIR = BASE_DIR
        self.DATA_DIR = DATA_DIR
        
        # Media configuration
        self.MEDIA_TYPES = {
            'video': {
                'extensions': {'.mp4', '.mov', '.avi', '.mkv'},
                'max_size': int(os.getenv('MAX_VIDEO_SIZE', str(10 * 1024 * 1024 * 1024))),
            },
            'image': {
                'extensions': {'.jpg', '.jpeg', '.png', '.gif'},
                'max_size': int(os.getenv('MAX_IMAGE_SIZE', str(1 * 1024 * 1024 * 1024))),
            }
        }
        
        # Set media path to Google Drive by default
        self.MEDIA_BASE_PATH = DEFAULT_MEDIA_PATH
        logger.info(f"Using media path: {self.MEDIA_BASE_PATH}")
        
        if not os.path.exists(self.MEDIA_BASE_PATH):
            raise ConfigurationError(f"Media path does not exist: {self.MEDIA_BASE_PATH}")
        
        if not os.path.isdir(self.MEDIA_BASE_PATH):
            raise ConfigurationError(f"Media path is not a directory: {self.MEDIA_BASE_PATH}")
        
        # Get supported extensions
        self.SUPPORTED_EXTENSIONS = self._get_supported_extensions()
        
        # API configuration
        self.API_PREFIX = API_PREFIX
        self.ENV = os.getenv('FLASK_ENV', 'development')
        self.DEBUG = self.ENV == 'development'
        self.HOST = HOST
        self.PORT = PORT
        
        # Security configuration
        self.CORS_ORIGINS = CORS_ORIGINS
        
        # Database configuration
        self.SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI
        self.SQLALCHEMY_TRACK_MODIFICATIONS = SQLALCHEMY_TRACK_MODIFICATIONS
        
        # Memory monitoring configuration
        self.MEMORY_WARNING_THRESHOLD = float(os.getenv('MEMORY_WARNING_THRESHOLD', '75.0'))
        self.MEMORY_CRITICAL_THRESHOLD = float(os.getenv('MEMORY_CRITICAL_THRESHOLD', '90.0'))
        self.MEMORY_CHECK_INTERVAL = int(os.getenv('MEMORY_CHECK_INTERVAL', '60'))
        
        # WebSocket configuration
        self.WEBSOCKET_PING_INTERVAL = int(os.getenv('WEBSOCKET_PING_INTERVAL', '25'))
        self.WEBSOCKET_PING_TIMEOUT = int(os.getenv('WEBSOCKET_PING_TIMEOUT', '10'))
        self.WEBSOCKET_MAX_MESSAGE_SIZE = int(os.getenv('WEBSOCKET_MAX_MESSAGE_SIZE', str(1024 * 1024)))
        
        # Perform validation
        self.validate()
    
    def _get_supported_extensions(self) -> Set[str]:
        """Get all supported file extensions."""
        return {ext for type_config in self.MEDIA_TYPES.values() 
                for ext in type_config['extensions']}
    
    def validate(self) -> bool:
        """Validate the entire configuration."""
        try:
            # Ensure data directory exists
            self.DATA_DIR.mkdir(parents=True, exist_ok=True)
            
            # Validate media types configuration
            if not any(t['extensions'] for t in self.MEDIA_TYPES.values()):
                raise ConfigurationError("No supported file extensions configured")
            
            # Validate memory thresholds
            if not 0 < self.MEMORY_WARNING_THRESHOLD < self.MEMORY_CRITICAL_THRESHOLD <= 100:
                raise ConfigurationError(
                    f"Invalid memory thresholds: warning ({self.MEMORY_WARNING_THRESHOLD}%) "
                    f"must be less than critical ({self.MEMORY_CRITICAL_THRESHOLD}%)"
                )
            
            # Validate port availability
            if self.PORT < 1024 and not os.geteuid() == 0:
                raise ConfigurationError(
                    f"Port {self.PORT} requires root privileges. "
                    "Please use a port number above 1024."
                )
            
            logger.info("Configuration validated successfully")
            return True
            
        except Exception as e:
            logger.error(f"Configuration validation failed: {str(e)}")
            raise ConfigurationError(f"Configuration validation failed: {str(e)}")

# Create and validate global configuration instance
try:
    config = Config()
    
    # Export commonly used configuration values at module level
    API_PREFIX = config.API_PREFIX
    MEDIA_BASE_PATH = config.MEDIA_BASE_PATH
    DEBUG = config.DEBUG
    HOST = config.HOST
    PORT = config.PORT
    CORS_ORIGINS = config.CORS_ORIGINS
    SQLALCHEMY_DATABASE_URI = config.SQLALCHEMY_DATABASE_URI
    SQLALCHEMY_TRACK_MODIFICATIONS = config.SQLALCHEMY_TRACK_MODIFICATIONS
    MEDIA_TYPES = config.MEDIA_TYPES
    SUPPORTED_EXTENSIONS = config.SUPPORTED_EXTENSIONS
    
except Exception as e:
    logger.critical(f"Failed to initialize configuration: {str(e)}")
    raise