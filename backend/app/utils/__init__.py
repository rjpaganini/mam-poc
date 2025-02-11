"""
Utility functions and helpers for the MAM application.
This module contains various utility functions for:
- Database initialization and population
- Metadata extraction
- File system operations
- Data verification
"""

from .extract_metadata import extract_metadata
from .backup import backup_database, restore_database
from .path_utils import sanitize_path, validate_media_path, get_relative_media_path, validate_media_access

__all__ = [
    'extract_metadata',
    'backup_database',
    'restore_database',
    'sanitize_path',
    'validate_media_path',
    'get_relative_media_path',
    'validate_media_access'
] 