"""Regenerate thumbnails for existing media assets"""

import os
import sys
from pathlib import Path
from datetime import datetime

# Add backend directory to Python path
backend_dir = Path(__file__).parent.parent.parent
sys.path.append(str(backend_dir))

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from backend.app.utils.thumbnail import ensure_thumbnail
from backend.app.config import Config
import logging

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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def get_absolute_path(self) -> Path:
        """Get absolute path to media file"""
        path = Path(self.file_path)
        if path.is_absolute() and path.exists():
            return path
            
        media_path = Path(Config.MEDIA_PATH)
        if str(path).startswith(str(media_path)):
            path = Path(str(path).replace(str(media_path), '').lstrip('/'))
        return media_path / path

def regenerate_thumbnails():
    """Regenerate thumbnails for all assets"""
    with app.app_context():
        # Get all assets
        assets = MediaAsset.query.all()
        logger.info(f"Found {len(assets)} assets in database")
        
        # Create thumbnails directory if it doesn't exist
        thumbnails_dir = Config.THUMBNAIL_DIR
        thumbnails_dir.mkdir(parents=True, exist_ok=True)
        
        # Track progress
        success_count = 0
        error_count = 0
        
        # Process each asset
        for asset in assets:
            try:
                video_path = asset.get_absolute_path()
                if not video_path.exists():
                    logger.error(f"Video file not found: {video_path}")
                    error_count += 1
                    continue
                
                # Generate new thumbnail
                thumb_path = ensure_thumbnail(video_path, thumbnails_dir, asset.id)
                if thumb_path:
                    success_count += 1
                    logger.info(f"Generated thumbnail for {asset.title}")
                else:
                    error_count += 1
                    logger.error(f"Failed to generate thumbnail for {asset.title}")
                    
            except Exception as e:
                error_count += 1
                logger.error(f"Error processing {asset.title}: {e}")
                continue
        
        # Commit changes to database
        try:
            db.session.commit()
            logger.info("\nThumbnail regeneration complete!")
            logger.info(f"Successfully generated: {success_count} thumbnails")
            logger.info(f"Failed: {error_count} thumbnails")
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to commit changes to database: {e}")

if __name__ == '__main__':
    logger.info("Starting thumbnail regeneration...")
    logger.info("Using 5-second timestamp for all thumbnails")
    regenerate_thumbnails() 