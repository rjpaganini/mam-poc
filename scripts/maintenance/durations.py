#!/usr/bin/env python3
"""
Duration Check Script for MAM application
Author: Senior Developer
Version: 2.0.0
Last Updated: 2025-02-13
"""

import os
import sys
import time
import json
import logging
from pathlib import Path
from datetime import datetime

# Add backend directory to Python path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.append(str(PROJECT_ROOT))

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from backend.app.config import Config
from backend.app.utils.extract_metadata import extract_metadata

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(PROJECT_ROOT / 'logs' / 'durations.log')
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

def format_duration(seconds):
    """Format duration in seconds to HH:MM:SS"""
    if not seconds:
        return "Unknown"
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    seconds = int(seconds % 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"

def check_asset_duration(asset):
    """Check duration for a single asset"""
    try:
        file_path = Path(asset.file_path)
        if not file_path.is_absolute():
            file_path = Path(Config.MEDIA_PATH) / file_path
            
        if not file_path.exists():
            return {
                "id": asset.id,
                "title": asset.title,
                "status": "error",
                "message": "File not found",
                "file_path": str(file_path)
            }
            
        metadata = extract_metadata(str(file_path))
        if not metadata:
            return {
                "id": asset.id,
                "title": asset.title,
                "status": "error",
                "message": "Failed to extract metadata",
                "file_path": str(file_path)
            }
            
        db_duration = asset.duration or 0
        actual_duration = metadata.get('duration', 0)
        
        # Check if durations match within 0.5 seconds
        if abs(db_duration - actual_duration) > 0.5:
            return {
                "id": asset.id,
                "title": asset.title,
                "status": "mismatch",
                "db_duration": format_duration(db_duration),
                "actual_duration": format_duration(actual_duration),
                "file_path": str(file_path)
            }
            
        return {
            "id": asset.id,
            "title": asset.title,
            "status": "ok",
            "duration": format_duration(actual_duration),
            "file_path": str(file_path)
        }
        
    except Exception as e:
        return {
            "id": asset.id,
            "title": asset.title,
            "status": "error",
            "message": str(e),
            "file_path": str(file_path)
        }

def check_durations(specific_ids=None):
    """Check durations for all or specific media assets"""
    start_time = time.time()
    logger.info("Starting duration check...")
    
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
            duration = db.Column(db.Float)
            duration_formatted = db.Column(db.String(32))
        
        with app.app_context():
            # Get assets
            query = MediaAsset.query
            if specific_ids:
                query = query.filter(MediaAsset.id.in_(specific_ids))
            assets = query.all()
            
            total_assets = len(assets)
            logger.info(f"Found {total_assets} media assets to check")
            
            if total_assets == 0:
                logger.info("No media assets found")
                return True
            
            # Check each asset
            results = []
            for asset in assets:
                result = check_asset_duration(asset)
                results.append(result)
                logger.info(f"Checked asset {asset.id}: {result['status']}")
            
            # Generate report
            report = {
                "timestamp": datetime.now().isoformat(),
                "total_assets": total_assets,
                "ok_count": sum(1 for r in results if r['status'] == 'ok'),
                "mismatch_count": sum(1 for r in results if r['status'] == 'mismatch'),
                "error_count": sum(1 for r in results if r['status'] == 'error'),
                "results": results
            }
            
            # Save report
            report_dir = PROJECT_ROOT / 'logs' / 'reports'
            report_dir.mkdir(exist_ok=True)
            report_path = report_dir / f'duration_check_{int(time.time())}.json'
            
            with open(report_path, 'w') as f:
                json.dump(report, f, indent=2)
            
            # Log summary
            duration = time.time() - start_time
            logger.info(f"Duration check completed in {duration:.2f} seconds")
            logger.info(f"Report saved to: {report_path}")
            logger.info(f"Summary: {report['ok_count']} OK, {report['mismatch_count']} mismatches, {report['error_count']} errors")
            
            return report['error_count'] == 0
            
    except Exception as e:
        logger.error(f"Duration check failed: {e}")
        return False

if __name__ == '__main__':
    try:
        # Parse command line arguments for specific asset IDs
        specific_ids = None
        if len(sys.argv) > 1:
            try:
                specific_ids = [int(id_str) for id_str in sys.argv[1:]]
            except ValueError:
                logger.error("Invalid asset IDs provided")
                sys.exit(1)
        
        success = check_durations(specific_ids)
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.info("Duration check interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error during duration check: {e}")
        sys.exit(1) 