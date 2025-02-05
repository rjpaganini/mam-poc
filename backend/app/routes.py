"""
API routes for the Media Asset Management system.
Simplified for local development without authentication.
"""

from flask import Blueprint, jsonify, request, current_app, send_file, Response, send_from_directory
from flask_cors import cross_origin, CORS
from flask_sock import Sock  # Add WebSocket support
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import text
from .database import db
from .models import MediaAsset, Tag, MediaDirectory
from .config import API_PREFIX, MEDIA_BASE_PATH
from .utils.path_utils import sanitize_path, validate_media_path, validate_media_access
from .utils.extract_metadata import extract_metadata, generate_thumbnail
from .utils.process_directory import process_directory
from .utils.error_handler import MediaError, error_handler
from .utils.logger import log_operation
from datetime import datetime
import os
import mimetypes
import subprocess
import pwd
import re
import sys
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional
from .utils.file_utils import file_reader, partial_file_reader
from .websocket import sock, connection_pool
import simple_websocket
import uuid

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create blueprint with API prefix
api = Blueprint('api', __name__, url_prefix=API_PREFIX)

def init_app(app):
    """Initialize application state."""
    # Enable CORS for all routes with updated port
    CORS(app, resources={
        r"/*": {  # Allow all routes
            "origins": ["http://localhost:3001", "http://127.0.0.1:3001"],  # Restrict to frontend origin
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Range", "Authorization", "Upgrade", "Connection"],
            "expose_headers": ["Content-Range", "Accept-Ranges", "Content-Length"],
            "supports_credentials": True
        }
    })
    
    # Initialize MIME types for video formats
    mimetypes.add_type('video/mp4', '.mp4')
    mimetypes.add_type('video/quicktime', '.mov')
    mimetypes.add_type('video/x-msvideo', '.avi')
    mimetypes.add_type('video/x-matroska', '.mkv')
    
    logger.info("Server starting with:")
    logger.info(f"MEDIA_BASE_PATH: {os.getenv('MEDIA_BASE_PATH')}")
    logger.info(f"Working Directory: {os.getcwd()}")
    
    # Register the blueprint
    app.register_blueprint(api)
    
    # Register unprefixed routes for backward compatibility
    app.add_url_rule('/assets', 'unprefixed_assets', get_assets)

@api.route('/assets', methods=['GET'])
def get_assets():
    """Get all media assets with optional filtering."""
    try:
        # Get query parameters
        tag = request.args.get('tag')
        search = request.args.get('search')
        
        # Base query
        query = MediaAsset.query
        
        # Apply filters if provided
        if tag:
            query = query.join(MediaAsset.tags).filter(Tag.name == tag.lower())
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (MediaAsset.title.ilike(search_term)) |
                (MediaAsset.description.ilike(search_term))
            )
        
        # Execute query and convert to dict
        assets = [asset.to_dict() for asset in query.all()]
        
        # Log response size
        logger.info(f"Returning {len(assets)} assets")
        
        # Always return a JSON array, even if empty
        return jsonify(assets if assets else [])
    
    except Exception as e:
        # Log error but maintain API contract by returning empty array
        logger.error(f"Error fetching assets: {str(e)}")
        return jsonify([])

@api.route('/assets/<int:asset_id>', methods=['GET'])
def get_asset(asset_id):
    """Get a specific media asset by ID."""
    try:
        asset = MediaAsset.query.get_or_404(asset_id)
        asset_dict = asset.to_dict()
        
        # Add additional validation info
        asset_dict['file_exists'] = os.path.exists(asset.file_path)
        asset_dict['file_size_on_disk'] = os.path.getsize(asset.file_path) if asset_dict['file_exists'] else None
        
        return jsonify(asset_dict)
    except Exception as e:
        current_app.logger.error(f"Error fetching asset {asset_id}: {str(e)}", exc_info=True)
        return jsonify({
            "error": "Failed to fetch asset",
            "details": {
                "asset_id": asset_id,
                "error_type": type(e).__name__,
                "error_message": str(e)
            }
        }), 500

@api.route('/assets/<int:asset_id>', methods=['PUT'])
def update_asset(asset_id):
    """Update a media asset's metadata."""
    try:
        asset = MediaAsset.query.get_or_404(asset_id)
        data = request.get_json()
        
        # Update basic fields
        for field in ['title', 'description']:
            if field in data:
                setattr(asset, field, data[field])
        
        # Update tags
        if 'tags' in data:
            # Clear existing tags
            asset.tags = []
            
            # Add new tags
            for tag_name in data['tags']:
                tag = Tag.query.filter_by(name=tag_name.lower()).first()
                if not tag:
                    tag = Tag(name=tag_name.lower())
                    db.session.add(tag)
                asset.tags.append(tag)
        
        # Save changes
        db.session.commit()
        return jsonify(asset.to_dict())
    
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating asset {asset_id}: {str(e)}")
        return jsonify({"error": "Failed to update asset"}), 500

@api.route('/assets/<int:asset_id>', methods=['DELETE'])
def delete_asset(asset_id):
    """Delete a media asset."""
    try:
        asset = MediaAsset.query.get_or_404(asset_id)
        db.session.delete(asset)
        db.session.commit()
        return '', 204
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting asset {asset_id}: {str(e)}")
        return jsonify({"error": "Failed to delete asset"}), 500

@api.route('/open-folder', methods=['POST', 'OPTIONS'])
@cross_origin()
def open_folder():
    """Open folder in Finder."""
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        data = request.get_json()
        path = data.get('path')
        
        if not path:
            return jsonify({"error": "Path is required"}), 400
            
        # Validate path
        if not validate_media_path(path):
            return jsonify({"error": "Invalid path"}), 403
            
        # Open folder in Finder
        if os.path.exists(path):
            subprocess.run(['open', '-R', path])
            return jsonify({"message": "Folder opened", "path": path})
        else:
            return jsonify({"error": "Path not found"}), 404
            
    except Exception as e:
        current_app.logger.error(f"Error opening folder: {str(e)}")
        return jsonify({"error": "Failed to open folder"}), 500

@api.route('/media/<path:filename>')
@cross_origin()
def serve_media(filename):
    """
    Stream media files with proper headers and range support.
    Handles partial content requests for video streaming.
    """
    try:
        # Construct absolute path and validate
        file_path = os.path.join(MEDIA_BASE_PATH, filename)
        if not os.path.exists(file_path):
            current_app.logger.error(f"Media file not found: {file_path}")
            return jsonify({'error': 'Media file not found'}), 404

        # Get file size
        file_size = os.path.getsize(file_path)
        
        # Handle range requests
        range_header = request.headers.get('Range', None)
        
        if range_header:
            byte1, byte2 = 0, None
            match = re.search('bytes=(\d+)-(\d*)', range_header)
            groups = match.groups()
            
            if groups[0]:
                byte1 = int(groups[0])
            if groups[1]:
                byte2 = int(groups[1])
            
            if byte2 is None:
                byte2 = file_size - 1
            
            length = byte2 - byte1 + 1
            
            resp = Response(
                partial_file_reader(file_path, byte1, byte2),
                status=206,
                mimetype=mimetypes.guess_type(filename)[0],
                direct_passthrough=True
            )
            
            resp.headers.add('Content-Range', f'bytes {byte1}-{byte2}/{file_size}')
            resp.headers.add('Accept-Ranges', 'bytes')
            resp.headers.add('Content-Length', str(length))
        else:
            resp = Response(
                file_reader(file_path),
                mimetype=mimetypes.guess_type(filename)[0]
            )
            resp.headers.add('Content-Length', str(file_size))
        
        # Add CORS headers
        resp.headers.add('Access-Control-Allow-Origin', '*')
        resp.headers.add('Access-Control-Allow-Headers', 'Range')
        resp.headers.add('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges')
        resp.headers.add('Cache-Control', 'public, max-age=3600')
        
        return resp
        
    except Exception as e:
        current_app.logger.error(f"Error serving media file {filename}: {str(e)}")
        return jsonify({
            'error': 'Failed to serve media file',
            'details': str(e)
        }), 500

@api.route('/tags', methods=['GET'])
def get_tags():
    """Get all tags."""
    try:
        tags = [tag.to_dict() for tag in Tag.query.all()]
        return jsonify(tags)
    except Exception as e:
        current_app.logger.error(f"Error fetching tags: {str(e)}")
        return jsonify({"error": "Failed to fetch tags"}), 500

@api.route('/tags', methods=['POST'])
def create_tag():
    """Create a new tag."""
    try:
        data = request.get_json()
        name = data.get('name', '').lower().strip()
        
        # Check if tag already exists
        existing_tag = Tag.query.filter_by(name=name).first()
        if existing_tag:
            return jsonify(existing_tag.to_dict())
        
        # Create new tag
        tag = Tag(name=name)
        db.session.add(tag)
        db.session.commit()
        
        return jsonify(tag.to_dict()), 201
    
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating tag: {str(e)}")
        return jsonify({"error": "Failed to create tag"}), 500

@api.route('/tags/<int:tag_id>', methods=['DELETE'])
def delete_tag(tag_id):
    """Delete a tag."""
    try:
        tag = Tag.query.get_or_404(tag_id)
        db.session.delete(tag)
        db.session.commit()
        return '', 204
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting tag {tag_id}: {str(e)}")
        return jsonify({"error": "Failed to delete tag"}), 500

@api.route('/directories', methods=['GET'])
def get_directories():
    """Get all media directories."""
    try:
        directories = MediaDirectory.query.all()
        return jsonify([dir.to_dict() for dir in directories])
    except Exception as e:
        current_app.logger.error(f"Error fetching directories: {str(e)}")
        return jsonify({"error": "Failed to fetch directories"}), 500

@api.route('/directories', methods=['POST'])
def add_directory():
    """Add a new media directory to watch."""
    try:
        data = request.get_json()
        path = data.get('path', '')
        name = data.get('name', '')
        
        if not path:
            return jsonify({"error": "Directory path is required"}), 400
        
        # Expand user path if needed
        expanded_path = os.path.expanduser(path)
        
        # Check if directory already exists
        existing_dir = MediaDirectory.query.filter_by(path=expanded_path).first()
        if existing_dir:
            # Update name if provided
            if name and name != existing_dir.name:
                existing_dir.name = name
                db.session.commit()
            
            # Scan directory
            assets = process_directory(expanded_path, existing_dir.id)
            existing_dir.last_scanned = datetime.utcnow()
            db.session.commit()
            
            return jsonify({
                "message": "Directory updated and scanned successfully",
                "directory": existing_dir.to_dict(),
                "assets_added": len(assets)
            })
        
        # Create new directory entry
        directory = MediaDirectory(
            path=expanded_path,
            name=name or os.path.basename(expanded_path)
        )
        
        db.session.add(directory)
        db.session.commit()
        
        # Scan the new directory
        assets = process_directory(expanded_path, directory.id)
        
        # Update last_scanned timestamp
        directory.last_scanned = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            "message": "Directory added and scanned successfully",
            "directory": directory.to_dict(),
            "assets_added": len(assets)
        }), 201
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error adding directory: {str(e)}")
        return jsonify({"error": "Failed to add directory"}), 500

@api.route('/directories/<int:directory_id>', methods=['DELETE'])
def remove_directory(directory_id):
    """Remove a directory from watching (doesn't delete files)."""
    try:
        directory = MediaDirectory.query.get_or_404(directory_id)
        db.session.delete(directory)
        db.session.commit()
        return '', 204
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error removing directory: {str(e)}")
        return jsonify({"error": "Failed to remove directory"}), 500

@api.route('/scan', methods=['POST'])
def scan_directories():
    """Scan all active directories or a specific directory for new media files."""
    try:
        data = request.get_json()
        directory_id = data.get('directory_id')
        
        total_assets = 0
        scanned_dirs = []
        
        if directory_id:
            # Scan specific directory
            directory = MediaDirectory.query.get_or_404(directory_id)
            assets = process_directory(directory.path, directory_id)
            total_assets = len(assets)
            directory.last_scanned = datetime.utcnow()
            scanned_dirs.append(directory.to_dict())
        else:
            # Scan all active directories
            directories = MediaDirectory.query.filter_by(is_active=True).all()
            for directory in directories:
                try:
                    assets = process_directory(directory.path, directory.id)
                    total_assets += len(assets)
                    directory.last_scanned = datetime.utcnow()
                    scanned_dirs.append(directory.to_dict())
                except Exception as e:
                    current_app.logger.error(f"Error scanning directory {directory.path}: {str(e)}")
        
        db.session.commit()
        
        return jsonify({
            "message": "Scan complete",
            "total_assets_added": total_assets,
            "scanned_directories": scanned_dirs
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error during scan: {str(e)}")
        return jsonify({"error": "Failed to complete scan"}), 500

@api.route('/debug/paths')
@cross_origin()
def debug_paths():
    """Debug endpoint to verify path resolution."""
    return jsonify({
        'cwd': os.getcwd(),
        'media_base': MEDIA_BASE_PATH,
        'media_base_exists': os.path.exists(MEDIA_BASE_PATH),
        'media_base_expanded': os.path.expanduser(MEDIA_BASE_PATH),
        'user': pwd.getpwuid(os.getuid()).pw_name,
        'home': os.path.expanduser('~'),
        'files': os.listdir(MEDIA_BASE_PATH) if os.path.exists(MEDIA_BASE_PATH) else []
    })

@api.route('/thumbnails/<path:filename>')
@cross_origin()
def serve_thumbnail(filename):
    """Serve thumbnail images."""
    try:
        # Construct absolute path to thumbnail file
        media_base = os.path.expanduser(os.getenv('MEDIA_BASE_PATH', ''))
        if not media_base:
            current_app.logger.error("MEDIA_BASE_PATH not set")
            return jsonify({"error": "Server configuration error"}), 500
            
        thumbnails_dir = os.path.join(os.path.dirname(media_base), 'thumbnails')
        thumbnails_dir = os.path.expanduser(thumbnails_dir)  # Expand path again for nested paths
        filepath = os.path.join(thumbnails_dir, filename)
        
        current_app.logger.info(f"Attempting to serve thumbnail: {filepath}")
        
        # Validate file exists and is accessible
        if not os.path.exists(filepath):
            current_app.logger.error(f"Thumbnail not found: {filepath}")
            return jsonify({"error": "Thumbnail not found"}), 404
            
        # Add no-cache headers to force browser to reload thumbnails
        response = send_file(filepath, mimetype='image/jpeg')
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response
        
    except Exception as e:
        current_app.logger.error(f"Error serving thumbnail: {str(e)}", exc_info=True)
        return jsonify({
            "error": "Failed to serve thumbnail",
            "details": str(e)
        }), 500

@api.route('/logs', methods=['POST', 'OPTIONS'])
@cross_origin()
def handle_logs():
    """Handle log messages from the frontend."""
    try:
        if request.method == 'OPTIONS':
            # Handle preflight request
            response = jsonify({'status': 'ok'})
            response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
            return response
            
        # Get log data from request
        log_data = request.get_json()
        
        # Log to backend logger
        log_level = log_data.get('level', 'info').lower()
        message = log_data.get('message', '')
        
        if log_level == 'error':
            current_app.logger.error(f"Frontend: {message}")
        elif log_level == 'warn':
            current_app.logger.warning(f"Frontend: {message}")
        elif log_level == 'debug':
            current_app.logger.debug(f"Frontend: {message}")
        else:
            current_app.logger.info(f"Frontend: {message}")
            
        return jsonify({'status': 'ok'})
        
    except Exception as e:
        current_app.logger.error(f"Error handling logs: {str(e)}")
        return jsonify({
            "error": "Failed to handle logs",
            "details": str(e)
        }), 500

@api.route('/websocket/stats')
@cross_origin()
def websocket_stats():
    """Get current WebSocket connection statistics."""
    try:
        stats = connection_pool.get_stats()
        return jsonify({
            'status': 'success',
            'timestamp': datetime.utcnow().isoformat(),
            'stats': stats
        }), 200
    except Exception as e:
        current_app.logger.error(f"Failed to get WebSocket stats: {e}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 500

@api.route('/regenerate-thumbnails', methods=['POST'])
@cross_origin()
def regenerate_thumbnails():
    """Regenerate thumbnails for all video assets."""
    try:
        # Get request data
        data = request.get_json() or {}
        thumbnail_timestamp = data.get('timestamp', 6)  # Default to 6 seconds if not specified
        
        # Get thumbnails directory
        media_base = os.path.expanduser(os.getenv('MEDIA_BASE_PATH', ''))
        if not media_base:
            current_app.logger.error("MEDIA_BASE_PATH not set")
            return jsonify({"error": "Server configuration error"}), 500
            
        thumbnails_dir = os.path.join(os.path.dirname(media_base), 'thumbnails')
        
        # Clean up existing thumbnails
        if os.path.exists(thumbnails_dir):
            current_app.logger.info(f"Cleaning up existing thumbnails in {thumbnails_dir}")
            for file in os.listdir(thumbnails_dir):
                try:
                    os.remove(os.path.join(thumbnails_dir, file))
                    current_app.logger.info(f"Removed old thumbnail: {file}")
                except Exception as e:
                    current_app.logger.warning(f"Failed to remove thumbnail {file}: {e}")
        
        # Get all video assets
        assets = MediaAsset.query.filter(MediaAsset.mime_type.like('video/%')).all()
        
        results = {
            'success': 0,
            'failed': 0,
            'errors': [],
            'timestamp_used': thumbnail_timestamp  # Include the timestamp used in response
        }
        
        # Regenerate thumbnails
        for asset in assets:
            try:
                if not os.path.exists(asset.file_path):
                    raise FileNotFoundError(f"Video file not found: {asset.file_path}")
                
                # Generate new thumbnail at specified timestamp
                thumbnail_path = generate_thumbnail(asset.file_path, timestamp=thumbnail_timestamp)
                if thumbnail_path:
                    # Update asset metadata
                    current_metadata = asset.media_metadata or {}
                    
                    # Create a new dictionary with updated thumbnail info
                    updated_metadata = {
                        **current_metadata,  # Preserve existing metadata
                        'thumbnail_url': f"/thumbnails/{os.path.basename(thumbnail_path)}",
                        'thumbnail_timestamp': thumbnail_timestamp,  # Store the actual timestamp used
                        'thumbnail_generated_at': datetime.utcnow().isoformat()  # Add generation timestamp
                    }
                    
                    # Update the asset with the merged metadata
                    asset.media_metadata = updated_metadata
                    asset.thumbnail_timestamp = thumbnail_timestamp  # Update root level field too
                    db.session.add(asset)
                    db.session.flush()
                    results['success'] += 1
                else:
                    raise Exception("Thumbnail generation returned None")
                    
            except Exception as e:
                results['failed'] += 1
                results['errors'].append({
                    'asset_id': asset.id,
                    'title': asset.title,
                    'error': str(e)
                })
                current_app.logger.error(f"Failed to regenerate thumbnail for {asset.title}: {str(e)}")
                continue
        
        # Commit all changes at once
        db.session.commit()
        
        # Add cache-busting timestamp to response
        results['generation_timestamp'] = datetime.utcnow().isoformat()
        
        return jsonify({
            "message": "Thumbnail regeneration complete",
            "results": results
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error during thumbnail regeneration: {str(e)}")
        return jsonify({
            "error": "Failed to regenerate thumbnails",
            "details": str(e)
        }), 500

# Initialize WebSocket with proper error handling
sock = Sock()

@sock.route('/ws')
def handle_websocket(ws):
    """
    WebSocket connection handler with improved error handling and heartbeat.
    Supports:
    - Initial connection status
    - Heartbeat (ping/pong)
    - Graceful disconnection
    - Detailed error logging
    """
    connection_id = str(uuid.uuid4())[:8]  # Generate unique connection ID for tracking
    
    try:
        current_app.logger.info(f"New WebSocket connection established [id={connection_id}]")
        
        # Send initial connection status
        ws.send(json.dumps({
            'type': 'connection_status',
            'data': {
                'status': 'connected',
                'connectionId': connection_id,
                'serverTime': datetime.utcnow().isoformat()
            }
        }))
        
        # Main message loop
        while True:
            try:
                data = ws.receive()
                if data is None:  # Connection closed by client
                    break
                    
                if data == 'ping':
                    ws.send(json.dumps({
                        'type': 'pong',
                        'data': {
                            'status': 'alive',
                            'connectionId': connection_id,
                            'serverTime': datetime.utcnow().isoformat()
                        }
                    }))
                    
            except simple_websocket.ConnectionClosed:
                current_app.logger.info(f"WebSocket connection closed gracefully [id={connection_id}]")
                break
                
    except Exception as e:
        current_app.logger.error(f"WebSocket error [id={connection_id}]: {str(e)}")
        # Attempt to send error message to client
        try:
            ws.send(json.dumps({
                'type': 'error',
                'data': {
                    'message': 'Internal server error',
                    'connectionId': connection_id
                }
            }))
        except:
            pass  # If sending error fails, just log it
    finally:
        current_app.logger.info(f"WebSocket connection terminated [id={connection_id}]") 