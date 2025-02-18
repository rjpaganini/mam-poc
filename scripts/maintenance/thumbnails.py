#!/usr/bin/env python3
"""
Thumbnail Regeneration Script for MAM application
Author: Senior Developer
Version: 2.0.0
Last Updated: 2024-02-13
"""

import os
import sys
import time
import logging
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm

# Add backend directory to Python path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.append(str(PROJECT_ROOT))

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from backend.app.utils.thumbnail import ensure_thumbnail
from backend.app.config import Config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(PROJECT_ROOT / 'logs' / 'thumbnails.log')
    ]
)
logger = logging.getLogger(__name__)

def create_app():
    """Create Flask app with database configuration"""
    try:
        app = Flask(__name__)
        app.config['SQLALCHEMY_DATABASE_URI'] = Config.SQLALCHEMY_DATABASE_URI
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        return app
    except Exception as e:
        logger.error(f"Failed to create app: {e}")
        raise

def process_media_asset(asset):
    """Process a single media asset"""
    try:
        file_path = asset.get_absolute_path()
        if not file_path.exists():
            logger.warning(f"File not found: {file_path}")
            return False
            
        thumbnail_path = ensure_thumbnail(str(file_path))
        if thumbnail_path:
            logger.debug(f"Generated thumbnail for: {file_path}")
            return True
        else:
            logger.warning(f"Failed to generate thumbnail for: {file_path}")
            return False
    except Exception as e:
        logger.error(f"Error processing {asset.file_path}: {e}")
        return False

def regenerate_thumbnails():
    """Regenerate thumbnails for all media assets"""
    start_time = time.time()
    logger.info("Starting thumbnail regeneration...")
    
    try:
        # Initialize Flask app and database
        app = create_app()
        db = SQLAlchemy(app)
        
        class MediaAsset(db.Model):
            """Media asset model with essential metadata"""
            __tablename__ = 'media_assets'
            
            id = db.Column(db.Integer, primary_key=True)
            title = db.Column(db.String(255), nullable=False)
            file_path = db.Column(db.String(1024), unique=True, nullable=False)
            file_size = db.Column(db.BigInteger)
            duration = db.Column(db.Float)
            
            def get_absolute_path(self) -> Path:
                """Get absolute path to media file"""
                path = Path(self.file_path)
                if path.is_absolute() and path.exists():
                    return path
                
                media_path = Path(Config.MEDIA_PATH)
                return media_path / self.file_path
        
        with app.app_context():
            # Get all media assets
            assets = MediaAsset.query.all()
            total_assets = len(assets)
            logger.info(f"Found {total_assets} media assets")
            
            if total_assets == 0:
                logger.info("No media assets found")
                return True
            
            # Process assets in parallel
            success_count = 0
            with ThreadPoolExecutor(max_workers=os.cpu_count()) as executor:
                futures = {executor.submit(process_media_asset, asset): asset for asset in assets}
                
                with tqdm(total=total_assets, desc="Regenerating thumbnails") as pbar:
                    for future in as_completed(futures):
                        if future.result():
                            success_count += 1
                        pbar.update(1)
            
            # Log results
            duration = time.time() - start_time
            success_rate = (success_count / total_assets) * 100
            logger.info(f"Thumbnail regeneration completed in {duration:.2f} seconds")
            logger.info(f"Successfully processed {success_count}/{total_assets} assets ({success_rate:.1f}%)")
            
            return success_count == total_assets
            
    except Exception as e:
        logger.error(f"Thumbnail regeneration failed: {e}")
        return False

if __name__ == '__main__':
    try:
        success = regenerate_thumbnails()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.info("Thumbnail regeneration interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error during thumbnail regeneration: {e}")
        sys.exit(1) 