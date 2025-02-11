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
    # Base paths
    BASE_DIR = Path(__file__).parent.parent
    DATA_DIR = Path(os.getenv('DATA_DIR', BASE_DIR.parent/'data')).resolve()
    MEDIA_PATH = Path(os.getenv('MEDIA_PATH', BASE_DIR.parent/'media')).resolve()
    THUMBNAIL_DIR = DATA_DIR/'thumbnails'
    
    # Database configuration
    # Using merged.db - Enhanced schema with metadata, tags, and AI processing support
    # Created: Feb 2024 - Combines normalized structure with rich feature support
    SQLALCHEMY_DATABASE_URI = f'sqlite:///{DATA_DIR}/merged.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # API
    API_PREFIX = '/api/v1'
    HOST = '127.0.0.1'
    PORT = 5001
    
    # Media settings
    ALLOWED_EXTENSIONS = {'.mp4', '.mov', '.avi'}  # Only video files
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

class ConfigurationError(Exception):
    """Raised when configuration validation fails"""
    pass

# Create config instance
config = Config()