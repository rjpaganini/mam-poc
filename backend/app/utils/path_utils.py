# backend/app/utils/path_utils.py
# Utilities for path sanitization and validation

import os
import re
from pathlib import Path
from typing import Optional, Union, Dict, Any
from ..config import MEDIA_BASE_PATH, MEDIA_LOCATIONS
from .error_handler import MediaError

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
            
        if any(part in ['..'] for part in clean_path.parts):
            raise MediaError(
                message="Invalid path: Contains parent directory references",
                status_code=400,
                details={"path": str(path)}
            )
            
        return clean_path
        
    except Exception as e:
        if isinstance(e, MediaError):
            raise
        raise MediaError(
            message=f"Invalid path: {str(e)}",
            status_code=400,
            details={"path": str(path)}
        )

def validate_media_path(path: Union[str, Path], base_path: Optional[Union[str, Path]] = None) -> bool:
    """
    Validate that a path is within the allowed media directory.
    
    Args:
        path: Path to validate
        base_path: Optional base path to check against
        
    Returns:
        bool: True if path is valid
    """
    try:
        path = Path(path).resolve()
        base = Path(base_path or MEDIA_BASE_PATH).resolve()
        return str(path).startswith(str(base))
    except Exception:
        return False

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