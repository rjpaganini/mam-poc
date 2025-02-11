# backend/app/utils/path_utils.py
"""Simple path validation utilities"""

import os
from pathlib import Path
from typing import Union, Dict, Any, Optional
from ..config import Config

class MediaError(Exception):
    """Custom exception for media-related errors"""
    def __init__(self, message: str, status_code: int = 500, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.status_code = status_code
        self.details = details if details is not None else {}
        super().__init__(self.message)

# Legacy media locations (to be removed in future)
MEDIA_BASE_PATH = os.getenv('MEDIA_BASE_PATH', '')
MEDIA_LOCATIONS = {
    'primary': {'path': os.getenv('PRIMARY_MEDIA_PATH', '')},
    'archive': {'path': os.getenv('ARCHIVE_MEDIA_PATH', '')}
}

def validate_media_path(path: Union[str, Path]) -> bool:
    """Validate that a path is within the allowed media directory"""
    try:
        path = Path(path).resolve()
        base = Path(Config.MEDIA_PATH).resolve()
        
        # Basic security checks
        if any(part.startswith('.') for part in path.parts):
            return False
            
        if any(part in ['..', '~'] for part in path.parts):
            return False
            
        # Check extension
        if path.suffix.lower() not in Config.ALLOWED_EXTENSIONS:
            return False
            
        # Check if within media directory
        return str(path).startswith(str(base))
        
    except Exception:
        return False

def sanitize_path(path: Union[str, Path]) -> Path:
    """
    Sanitize and validate a file path.
    
    Args:
        path: Path to sanitize
        
    Returns:
        Sanitized Path object
        
    Raises:
        MediaError: If path is invalid or unsafe
    """
    try:
        # Convert to Path object and resolve
        clean_path = Path(path).resolve()
        
        # Basic security checks
        if any(part.startswith('.') for part in clean_path.parts):
            raise MediaError(
                message="Invalid path: Contains hidden directories",
                status_code=400,
                details={"path": str(path)}
            )
            
        if any(part in ['..', '~'] for part in clean_path.parts):
            raise MediaError(
                message="Invalid path: Contains unsafe path components",
                status_code=400,
                details={"path": str(path)}
            )
            
        # Check for valid file extension
        if clean_path.suffix.lower() not in Config.ALLOWED_EXTENSIONS:
            raise MediaError(
                message="Invalid file type",
                status_code=400,
                details={
                    "path": str(path),
                    "allowed_extensions": list(Config.ALLOWED_EXTENSIONS)
                }
            )
            
        # Check file size if file exists
        if clean_path.exists() and clean_path.is_file():
            if clean_path.stat().st_size > Config.MAX_FILE_SIZE:
                raise MediaError(
                    message="File exceeds maximum allowed size",
                    status_code=400,
                    details={
                        "path": str(path),
                        "size": clean_path.stat().st_size,
                        "max_size": Config.MAX_FILE_SIZE
                    }
                )
            
        return clean_path
        
    except Exception as e:
        if isinstance(e, MediaError):
            raise
        raise MediaError(
            message="Path validation error",
            status_code=400,
            details={"path": str(path), "error": str(e)}
        )

def validate_media_access(filepath: Union[str, Path]) -> Dict[str, Any]:
    """
    Validate media file access with detailed error reporting.
    
    Args:
        filepath: Path to the media file
        
    Returns:
        Dict containing file metadata if validation passes
        
    Raises:
        MediaError: If file access validation fails
    """
    try:
        path = Path(filepath).resolve()
        
        if not path.exists():
            raise MediaError(
                message="Media file not found",
                status_code=404,
                details={
                    "filepath": str(path),
                    "parent_exists": path.parent.exists(),
                    "is_file": path.is_file() if path.exists() else None
                }
            )
        
        if not os.access(path, os.R_OK):
            raise MediaError(
                message="Permission denied",
                status_code=403,
                details={
                    "filepath": str(path),
                    "owner": path.stat().st_uid,
                    "permissions": oct(path.stat().st_mode)[-3:]
                }
            )
        
        if not path.is_file():
            raise MediaError(
                message="Not a file",
                status_code=400,
                details={
                    "filepath": str(path),
                    "type": "directory" if path.is_dir() else "unknown"
                }
            )
            
        # Return file metadata on success
        return {
            "path": str(path),
            "size": path.stat().st_size,
            "modified": path.stat().st_mtime,
            "permissions": oct(path.stat().st_mode)[-3:],
            "is_file": True
        }
            
    except Exception as e:
        if isinstance(e, MediaError):
            raise
        raise MediaError(
            message=f"File access error: {str(e)}",
            status_code=500,
            details={"filepath": str(filepath)}
        )

def get_relative_media_path(full_path: Path) -> Optional[str]:
    """
    Convert absolute path to relative path from media base.
    
    Args:
        full_path: Absolute path to convert
        
    Returns:
        Optional[str]: Relative path if within media locations, None otherwise
    """
    try:
        # Check each media location
        for location_key, location in MEDIA_LOCATIONS.items():
            base_path = Path(location['path']).resolve()
            try:
                relative = full_path.relative_to(base_path)
                return f"{location_key}/{relative}"
            except ValueError:
                continue
                
        # Fallback to legacy MEDIA_BASE_PATH
        base_path = Path(MEDIA_BASE_PATH).resolve()
        try:
            return str(full_path.relative_to(base_path))
        except ValueError:
            return None
            
    except Exception as e:
        return None 