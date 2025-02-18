"""Clean up thumbnails, keeping only the main asset thumbnails used by AssetCard.js"""

import os
import sys
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent.parent.parent
sys.path.append(str(backend_dir))

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
import logging
from backend.app.config import Config
from typing import Set

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Configure database
app.config['SQLALCHEMY_DATABASE_URI'] = Config.SQLALCHEMY_DATABASE_URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database
db = SQLAlchemy(app)

class MediaAsset(db.Model):
    """Media asset model with essential metadata"""
    __tablename__ = 'media_assets'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(1024), unique=True, nullable=False)
    file_size = db.Column(db.BigInteger)
    file_size_mb = db.Column(db.Float)
    format = db.Column(db.String(32))
    duration = db.Column(db.Float)
    duration_formatted = db.Column(db.String(32))
    width = db.Column(db.Integer)
    height = db.Column(db.Integer)
    fps = db.Column(db.Float)
    codec = db.Column(db.String(32))
    container_format = db.Column(db.String(32))
    bit_rate = db.Column(db.Integer)
    audio_codec = db.Column(db.String(32))
    audio_channels = db.Column(db.Integer)
    audio_sample_rate = db.Column(db.Integer)

def get_valid_asset_ids() -> Set[str]:
    """Get set of valid asset IDs from database"""
    with app.app_context():
        # Get all asset IDs
        assets = MediaAsset.query.all()
        return {str(asset.id) for asset in assets}

def cleanup_thumbnails() -> tuple[int, int]:
    """
    Clean up thumbnails:
    1. Keep only main thumbnails (e.g., '123.jpg') that are used by AssetCard.js
    2. Remove all scrubbing thumbnails (e.g., '123_0.jpg', '123_1.jpg', etc.)
    3. Remove any thumbnails for assets that no longer exist
    
    Returns:
        Tuple of (deleted_count, kept_count)
    """
    thumbnails_dir = Config.THUMBNAIL_DIR
    if not thumbnails_dir.exists():
        logger.error(f"Thumbnails directory not found: {thumbnails_dir}")
        return 0, 0
        
    # Get valid asset IDs
    valid_ids = get_valid_asset_ids()
    logger.info(f"Found {len(valid_ids)} assets in database")
    
    deleted_count = 0
    kept_count = 0
    
    # Process all thumbnails
    for thumb_file in thumbnails_dir.glob('*.jpg'):
        file_stem = thumb_file.stem  # e.g., "123" or "123_0"
        
        # Check if this is a scrubbing thumbnail (contains underscore)
        if '_' in file_stem:
            try:
                thumb_file.unlink()
                deleted_count += 1
                logger.info(f"Deleted scrubbing thumbnail: {thumb_file.name}")
            except Exception as e:
                logger.error(f"Error deleting {thumb_file}: {e}")
            continue
            
        # For main thumbnails, check if they belong to a valid asset
        if file_stem in valid_ids:
            kept_count += 1
            logger.debug(f"Keeping main thumbnail: {thumb_file.name}")
        else:
            try:
                thumb_file.unlink()
                deleted_count += 1
                logger.info(f"Deleted orphaned thumbnail: {thumb_file.name}")
            except Exception as e:
                logger.error(f"Error deleting {thumb_file}: {e}")
                
    return deleted_count, kept_count

if __name__ == '__main__':
    logger.info("Starting thumbnail cleanup...")
    logger.info("This will keep only the main thumbnails used by AssetCard.js")
    logger.info("All scrubbing thumbnails will be removed as they are no longer used")
    
    with app.app_context():
        deleted, kept = cleanup_thumbnails()
    
    logger.info("\nCleanup complete!")
    logger.info(f"Deleted: {deleted} thumbnails (scrubbing + orphaned)")
    logger.info(f"Kept: {kept} main thumbnails (one per asset)") 