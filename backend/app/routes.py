"""API routes for media asset management"""

from flask import Blueprint, jsonify, send_file
from pathlib import Path
from .models import MediaAsset, db
from .utils.extract_metadata import extract_metadata
from .config import Config

api = Blueprint('api', __name__)

@api.route('/assets', methods=['GET'])
def list_assets():
    """List all media assets"""
    assets = MediaAsset.query.all()
    return jsonify([asset.to_dict() for asset in assets])

@api.route('/assets/<int:asset_id>', methods=['GET'])
def get_asset(asset_id):
    """Get single asset details"""
    asset = MediaAsset.query.get_or_404(asset_id)
    return jsonify(asset.to_dict())

@api.route('/assets/<int:asset_id>/stream')
def stream_asset(asset_id):
    """Stream media file"""
    asset = MediaAsset.query.get_or_404(asset_id)
    return send_file(asset.file_path)

@api.route('/thumbnails/<filename>')
def get_thumbnail(filename):
    """Get asset thumbnail"""
    thumb_path = Config.THUMBNAIL_DIR / filename
    if not thumb_path.exists():
        return "Thumbnail not found", 404
    return send_file(thumb_path)

@api.route('/scan', methods=['POST'])
def scan_directory():
    """Scan media directory and add new files"""
    media_dir = Path(Config.MEDIA_PATH)
    if not media_dir.exists():
        return jsonify({"error": "Media directory not found"}), 404
        
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
                print(f"Error processing {file_path}: {e}")
                continue
    
    if new_files > 0:
        db.session.commit()
        
    return jsonify({
        "message": f"Scan complete. Added {new_files} new files.",
        "new_files": new_files
    }) 