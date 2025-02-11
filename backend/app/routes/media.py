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
from pathlib import Path
from ..utils.file_utils import file_reader, partial_file_reader
from typing import Tuple, Any, Dict, Union, cast, Optional, List
from functools import wraps
from sqlalchemy import and_, or_, join
from ..config import Config
from datetime import datetime

# Configure route-specific logger
logger = logging.getLogger(__name__)

# Custom error class
class APIError(Exception):
    """Base exception for API errors"""
    def __init__(self, message: str, status_code: int = 500, details: dict = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}

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

def error_response(message: str, status_code: int = 500, details: Optional[Dict[str, Any]] = None) -> Tuple[Response, int]:
    """Create standardized error response"""
    response = {
        'error': message,
        'timestamp': datetime.utcnow().isoformat()
    }
    if details:
        response['details'] = details
    return jsonify(response), status_code

@api.route('/assets', methods=['GET'])
@cross_origin()
@handle_errors
def get_assets() -> Tuple[Response, int]:
    """Get all media assets with proper error handling"""
    try:
        # Query all assets
        assets = MediaAsset.query.all()
        
        # Convert to list of dicts with error handling
        asset_list: List[Dict[str, Any]] = []
        for asset in assets:
            try:
                asset_dict = asset.to_dict()
                if asset_dict:  # Ensure we have valid data
                    asset_list.append(asset_dict)
            except Exception as e:
                logger.error(f"Error converting asset {asset.id} to dict: {e}")
                continue
        
        # Always return a list, even if empty
        return jsonify(asset_list), 200
        
    except Exception as e:
        logger.error(f"Failed to fetch assets: {e}")
        return error_response("Failed to fetch assets", details={"error": str(e)})

@api.route('/media/asset/<int:asset_id>', methods=['GET'])
@cross_origin()
@handle_errors
def serve_media(asset_id: int) -> Tuple[Response, int]:
    """
    Serve media file with proper error handling.
    Resolves relative paths to absolute paths using MEDIA_PATH configuration.
    """
    try:
        # Get asset or return 404
        asset = MediaAsset.query.get(asset_id)
        if not asset:
            return error_response("Asset not found", 404, {"asset_id": asset_id})
        
        # Get absolute path
        absolute_path = asset.get_absolute_path()
        logger.debug(f"Serving media file: {absolute_path}")
        
        if not absolute_path.exists():
            return error_response(
                "Media file not found", 
                404, 
                {
                    "asset_id": asset_id,
                    "relative_path": asset.file_path,
                    "absolute_path": str(absolute_path)
                }
            )
        
        # Serve file with proper mime type and return tuple
        response = send_file(
            str(absolute_path),
            mimetype=mimetypes.guess_type(str(absolute_path))[0],
            as_attachment=False,
            max_age=3600  # Cache for 1 hour
        )
        return response, 200
        
    except Exception as e:
        logger.error(f"Failed to serve media {asset_id}: {e}")
        return error_response(
            "Failed to serve media file",
            500,
            {"asset_id": asset_id, "error": str(e)}
        )

@api.route('/scan', methods=['POST'])
@cross_origin()
@handle_errors
def scan_directory() -> Tuple[Response, int]:
    """Scan media directory for new files"""
    try:
        media_dir = Path(current_app.config['MEDIA_PATH'])
        if not media_dir.exists():
            return error_response(
                "Media directory not found",
                404,
                {"path": str(media_dir)}
            )
            
        new_assets: List[Dict[str, Any]] = []
        for ext in current_app.config['ALLOWED_EXTENSIONS']:
            for file_path in media_dir.glob(f"**/*{ext}"):
                try:
                    # Skip if already in database
                    if MediaAsset.query.filter_by(file_path=str(file_path)).first():
                        continue
                        
                    # Extract metadata
                    metadata = extract_metadata(file_path)
                    if not metadata:
                        logger.warning(f"No metadata extracted for {file_path}")
                        continue
                    
                    # Create asset
                    asset = MediaAsset(
                        title=file_path.stem,
                        file_path=str(file_path),
                        file_size=metadata['file_size'],
                        file_size_mb=metadata['file_size_mb'],
                        format=metadata['format'],
                        duration=metadata.get('duration'),
                        duration_formatted=metadata.get('duration_formatted'),
                        width=metadata.get('width'),
                        height=metadata.get('height'),
                        fps=metadata.get('fps'),
                        codec=metadata.get('codec'),
                        container_format=metadata.get('container_format'),
                        bit_rate=metadata.get('bit_rate'),
                        audio_codec=metadata.get('audio_codec'),
                        audio_channels=metadata.get('audio_channels'),
                        audio_sample_rate=metadata.get('audio_sample_rate')
                    )
                    
                    db.session.add(asset)
                    db.session.flush()  # Get asset ID
                    
                    # Record processing result
                    result = ProcessingResult(
                        asset_id=asset.id,
                        processor_name='metadata_extractor',
                        status='completed',
                        result_data=metadata
                    )
                    db.session.add(result)
                    
                    new_assets.append(asset.to_dict())
                    
                except Exception as e:
                    logger.error(f"Error processing {file_path}: {e}")
                    continue
        
        if new_assets:
            db.session.commit()
            logger.info(f"Added {len(new_assets)} new assets")
            
        return jsonify({
            'message': f'Added {len(new_assets)} new files',
            'assets': new_assets
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Scan failed: {e}")
        return error_response("Directory scan failed", details={"error": str(e)})

@api.route('/assets/<int:asset_id>', methods=['GET'])
@cross_origin()
@handle_errors
def get_asset(asset_id: int) -> Tuple[Response, int]:
    """Get a single media asset"""
    try:
        asset = MediaAsset.query.get_or_404(asset_id)
        return jsonify(asset.to_dict()), 200
    except Exception as e:
        logger.error(f"Failed to fetch asset {asset_id}: {e}")
        return jsonify({"error": str(e)}), 500

@api.route('/thumbnails/<path:filename>', methods=['GET'])
@cross_origin()
@handle_errors
def serve_thumbnail(filename: str) -> Tuple[Response, int]:
    """Serve thumbnail files with proper headers."""
    logger.info(f"Thumbnail request for: {filename}")
    
    # Use Config.THUMBNAIL_DIR instead of current_app.config
    thumbnail_path = Config.THUMBNAIL_DIR / filename
    
    if not thumbnail_path.exists():
        logger.error(f"Thumbnail not found: {thumbnail_path}")
        response = jsonify({'error': 'Thumbnail not found'})
        return add_cors_headers(response), 404
    
    response = send_file(
        thumbnail_path,
        mimetype='image/jpeg',
        as_attachment=False,
        max_age=3600  # Cache for 1 hour
    )
    return add_cors_headers(response), 200

def register_media_routes(bp: Blueprint) -> None:
    """Register media routes with the main API blueprint"""
    bp.register_blueprint(api)
    logger.info("Media routes registered")

# End of routes 