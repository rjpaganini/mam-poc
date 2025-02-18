#!/usr/bin/env python3
"""Initialize database and scan media files"""

import sys
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.append(str(backend_dir))

from flask import Flask
from backend.app.database import db
from backend.app.models import MediaAsset, MediaDirectory, Tag, ProcessingResult
from backend.app.utils.extract_metadata import extract_metadata
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_app():
    """Create Flask app for database initialization"""
    app = Flask(__name__)
    
    # Configure database
    data_dir = Path('data').resolve()
    data_dir.mkdir(exist_ok=True)
    
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{data_dir}/merged.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['DATA_DIR'] = str(data_dir)
    
    # Initialize database
    db.init_app(app)
    return app

def init_database():
    """Initialize database and scan media directory"""
    # Create Flask app and push context
    app = create_app()
    app.app_context().push()
    
    try:
        # Drop and recreate all tables
        logger.info("Dropping existing tables...")
        db.drop_all()
        
        logger.info("Creating new tables...")
        db.create_all()
        
        # Scan media directory
        media_dir = Path('media')
        if not media_dir.exists():
            logger.error(f"Media directory not found: {media_dir}")
            return
        
        # Scan for media files
        new_files = 0
        allowed_extensions = ['.mp4', '.mov', '.avi', '.mkv']
        
        for ext in allowed_extensions:
            for file_path in media_dir.glob(f"**/*{ext}"):
                try:
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
                    new_files += 1
                    logger.info(f"Added: {file_path.name}")
                    
                except Exception as e:
                    logger.error(f"Error processing {file_path}: {e}")
                    continue
        
        if new_files > 0:
            db.session.commit()
            logger.info(f"Scan complete. Added {new_files} new files.")
        else:
            logger.info("No new files found.")
            
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise
    finally:
        db.session.remove()

if __name__ == '__main__':
    init_database() 