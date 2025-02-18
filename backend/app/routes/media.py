"""
Media-related routes for the MAM application.
Handles directory scanning, media access, and processing.

Route Structure:
- /assets: Asset management (GET, POST)
- /media/asset/<id>: Media streaming (GET, HEAD)
- /scan: Directory scanning
- /assets/<id>/process: AI processing

IMPORTANT: These routes are registered under the 'media' blueprint with /api/v1 prefix.
Final URLs will be prefixed with /api/v1 automatically.
"""

from flask import Blueprint, jsonify, request, current_app, Response, send_file
from flask_cors import cross_origin
from ..models import MediaAsset, MediaDirectory as Directory, Tag, ProcessingResult
from ..database import db
from ..utils.process_directory import process_directory
from ..utils.extract_metadata import extract_metadata
from ..utils.path_utils import validate_media_path
import logging
import os
import re
import mimetypes
import requests
from requests.exceptions import RequestException
from pathlib import Path
from ..utils.file_utils import file_reader, partial_file_reader
from typing import Tuple, Any, Dict, Union, cast, Optional, List, TypedDict, Literal
from functools import wraps
from sqlalchemy import and_, or_, join
from ..config import Config
from datetime import datetime
from sqlalchemy.sql import text

# Configure route-specific logger
logger = logging.getLogger(__name__)

# Type definitions for health check
class HealthStatus(TypedDict):
    status: str
    message: Optional[str]
    path: Optional[str]
    connections: Optional[int]
    protocols: Optional[List[str]]

class APIError(Exception):
    """Base exception for API errors"""
    def __init__(self, message: str, status_code: int = 500, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}

# Type definitions
class ProcessingResultData(TypedDict):
    asset_id: int
    processor_name: str
    status: Literal['completed', 'failed', 'pending']
    result_data: Dict[str, Any]

class ErrorResponseDetails(TypedDict, total=False):
    error: str
    path: str
    asset_id: Union[int, str]
    file_path: str
    details: Dict[str, Any]

# Create blueprint with proper name
api = Blueprint('media', __name__)

def handle_errors(f):
    """
    Decorator for consistent error handling and logging across routes.
    Ensures proper error responses and logging for all media routes.
    """
    @wraps(f)
    def wrapper(*args, **kwargs) -> Tuple[Response, int]:
        try:
            result = f(*args, **kwargs)
            if isinstance(result, tuple):
                return result
            return result, 200
        except Exception as e:
            # Log full error with traceback
            logger.error(f"Error in {f.__name__}: {str(e)}", exc_info=True)
            
            # Specific error handling
            if isinstance(e, FileNotFoundError):
                return jsonify({'error': 'Media file not found'}), 404
            elif isinstance(e, PermissionError):
                return jsonify({'error': 'Permission denied accessing media'}), 403
            
            # Generic error response
            return jsonify({
                'error': 'Internal server error',
                'details': str(e),
                'endpoint': f.__name__
            }), 500
    return wrapper

def add_cors_headers(response: Response) -> Response:
    """Add CORS headers to response"""
    response.headers.update({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
        'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
        'Cache-Control': 'public, max-age=3600'
    })
    return response

def error_response(message, status_code=500, details=None):
    """Create standardized error response"""
    response_data = {
        'error': message,
        'timestamp': datetime.utcnow().isoformat()
    }
    if details is not None:
        response_data['details'] = details
    return jsonify(response_data), status_code

@api.route('/assets', methods=['GET'])
@cross_origin()
@handle_errors
def list_assets() -> Tuple[Response, int]:
    """List all media assets"""
    try:
        assets = MediaAsset.query.all()
        return jsonify([asset.to_dict() for asset in assets]), 200
    except Exception as e:
        logger.error(f"Failed to list assets: {e}")
        raise APIError("Failed to list assets", 500)

@api.route('/assets/<int:asset_id>', methods=['GET'])
@cross_origin()
@handle_errors
def get_asset(asset_id: int) -> Tuple[Response, int]:
    """Get single asset details"""
    try:
        asset = MediaAsset.query.get_or_404(asset_id)
        return jsonify(asset.to_dict()), 200
    except Exception as e:
        logger.error(f"Failed to get asset {asset_id}: {e}")
        raise APIError(f"Failed to get asset {asset_id}", 500)

@api.route('/assets/<int:asset_id>/stream')
@cross_origin()
@handle_errors
def stream_asset(asset_id: int) -> Tuple[Response, int]:
    """Stream media file"""
    try:
        asset = MediaAsset.query.get_or_404(asset_id)
        return send_file(asset.file_path), 200
    except Exception as e:
        logger.error(f"Failed to stream asset {asset_id}: {e}")
        raise APIError(f"Failed to stream asset {asset_id}", 500)

@api.route('/thumbnails/<filename>', methods=['GET'])
@cross_origin()
def get_thumbnail(filename: str) -> Tuple[Response, int]:
    """Get asset thumbnail"""
    logger.info(f"Request started: GET /api/v1/thumbnails/{filename}")
    
    try:
        thumb_path = Config.THUMBNAIL_DIR / filename
        if not thumb_path.exists():
            logger.warning(f"Thumbnail not found: {filename}")
            return jsonify({
                'error': 'Thumbnail not found',
                'details': {'filename': filename}
            }), 404
            
        response = send_file(thumb_path)
        logger.info(f"Request completed: GET /api/v1/thumbnails/{filename} - Status: 200")
        return response, 200
        
    except Exception as e:
        logger.error(f"Failed to get thumbnail {filename}: {e}", exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'details': {'message': str(e), 'filename': filename}
        }), 500

@api.route('/scan', methods=['POST'])
@cross_origin()
@handle_errors
def scan_directory():
    """Scan media directory and add new files"""
    try:
        media_dir = Path(Config.MEDIA_PATH)
        if not media_dir.exists():
            raise APIError("Media directory not found", 404)
            
        new_files = 0
        for ext in Config.ALLOWED_EXTENSIONS:
            for file_path in media_dir.glob(f"**/*{ext}"):
                # Skip if already in database
                if MediaAsset.query.filter_by(file_path=str(file_path)).first():
                    continue
                    
                try:
                    # Extract video metadata
                    metadata = extract_metadata(file_path)
                    
                    # Create new asset
                    asset = MediaAsset(
                        title=file_path.stem,
                        file_path=str(file_path),
                        file_size=file_path.stat().st_size,
                        duration=metadata.get('duration'),
                        width=metadata.get('width'),
                        height=metadata.get('height'),
                        codec=metadata.get('codec')
                    )
                    db.session.add(asset)
                    new_files += 1
                    
                except Exception as e:
                    logger.error(f"Error processing {file_path}: {e}")
                    continue
        
        if new_files > 0:
            db.session.commit()
            
        return jsonify({
            "message": f"Scan complete. Added {new_files} new files.",
            "new_files": new_files
        })
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Failed to scan directory: {e}")
        raise APIError("Failed to scan directory", 500)

@api.route('/health/status')
@cross_origin()
def health_status() -> Tuple[Response, int]:
    """Basic health check that doesn't require WebSocket"""
    try:
        # Check database connection
        with db.engine.connect() as conn:
            conn.execute(text('SELECT 1'))
            
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'database': {
                'status': 'healthy',
                'message': 'Connected to database',
                'path': current_app.config.get('SQLALCHEMY_DATABASE_URI', '')
            }
        }), 200
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 503

@api.route('/assets/<int:asset_id>/process', methods=['POST'])
@cross_origin()
@handle_errors
def start_processing(asset_id: int) -> Tuple[Response, int]:
    """Start AI processing for a media asset"""
    try:
        # Get the asset
        asset = MediaAsset.query.get_or_404(asset_id)
        
        # Create initial processing result
        result = ProcessingResult(
            asset_id=asset_id,
            processor_name='ai_processor',
            status='pending',
            result_data=None
        )
        db.session.add(result)
        db.session.commit()
        
        # Get processing manager and queue asset
        if hasattr(current_app, 'processing_manager'):
            current_app.processing_manager.queue_asset(asset_id)
        else:
            raise RuntimeError("Processing manager not initialized")
        
        return jsonify({
            'status': 'processing',
            'message': f'Processing started for asset {asset.title}',
            'asset_id': asset_id
        }), 202
        
    except Exception as e:
        logger.error(f"Failed to start processing for asset {asset_id}: {e}")
        return jsonify({
            'error': 'Processing failed to start',
            'details': str(e)
        }), 500

def register_media_routes(bp: Blueprint) -> None:
    """Register media routes with the main API blueprint"""
    bp.register_blueprint(api)
    logger.info("Media routes registered")

# End of routes 