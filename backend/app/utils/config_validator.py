"""Configuration validation and management utilities."""
import os
from pathlib import Path
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class ConfigurationError(Exception):
    """Raised when configuration validation fails."""
    pass

def validate_path(path: str, create: bool = False, must_exist: bool = True) -> Path:
    """
    Validate and normalize a path.
    
    Args:
        path: The path to validate
        create: Whether to create the directory if it doesn't exist
        must_exist: Whether the path must exist
        
    Returns:
        Normalized Path object
        
    Raises:
        ConfigurationError: If path validation fails
    """
    try:
        # Expand user and environment variables
        expanded_path = os.path.expandvars(os.path.expanduser(path))
        normalized_path = Path(expanded_path).resolve()
        
        if not normalized_path.exists() and create:
            normalized_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"Created directory: {normalized_path}")
            
        if must_exist and not normalized_path.exists():
            raise ConfigurationError(f"Path does not exist: {normalized_path}")
            
        return normalized_path
        
    except Exception as e:
        raise ConfigurationError(f"Path validation failed for {path}: {str(e)}")

def validate_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate and normalize configuration.
    
    Args:
        config: Configuration dictionary
        
    Returns:
        Validated and normalized configuration
        
    Raises:
        ConfigurationError: If validation fails
    """
    validated = config.copy()
    
    # Validate media paths
    try:
        media_base = validate_path(
            config['MEDIA_BASE_PATH'],
            create=False,  # Don't create media directory automatically
            must_exist=True
        )
        validated['MEDIA_BASE_PATH'] = str(media_base)
        
        # Check media directory permissions
        if not os.access(media_base, os.R_OK):
            raise ConfigurationError(f"No read permission for media directory: {media_base}")
            
    except Exception as e:
        raise ConfigurationError(f"Media path validation failed: {str(e)}")
        
    # Validate backup directory
    try:
        backup_dir = validate_path(
            config.get('BACKUP_DIR', 'backups'),
            create=True,  # Create backup directory if it doesn't exist
            must_exist=False
        )
        validated['BACKUP_DIR'] = str(backup_dir)
        
    except Exception as e:
        raise ConfigurationError(f"Backup directory validation failed: {str(e)}")
        
    # Validate required settings
    required_settings = ['API_PREFIX', 'DATABASE_URL']
    for setting in required_settings:
        if not config.get(setting):
            raise ConfigurationError(f"Missing required configuration: {setting}")
            
    return validated

def get_environment_config() -> Dict[str, Any]:
    """
    Get configuration from environment variables with proper validation.
    
    Returns:
        Dictionary of validated configuration values
    """
    config = {
        'MEDIA_BASE_PATH': os.getenv('MEDIA_BASE_PATH', os.path.expanduser('~/media')),
        'DATABASE_URL': os.getenv('DATABASE_URL', 'sqlite:///data/mam.db'),
        'API_PREFIX': os.getenv('API_PREFIX', '/api/v1'),
        'DEBUG': os.getenv('FLASK_DEBUG', 'false').lower() == 'true',
        'BACKUP_DIR': os.getenv('BACKUP_DIR', 'backups'),
        'LOG_LEVEL': os.getenv('LOG_LEVEL', 'INFO'),
    }
    
    return validate_config(config) 