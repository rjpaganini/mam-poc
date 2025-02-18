"""Check video durations and metadata for specific assets"""

import os
import sys
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.append(str(backend_dir))

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
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
    duration = db.Column(db.Float)
    duration_formatted = db.Column(db.String(32))

def check_durations():
    """Check durations for specific assets"""
    with app.app_context():
        # Get assets with specific IDs
        asset_ids = [54, 56, 59]  # The ones with missing thumbnails
        assets = MediaAsset.query.filter(MediaAsset.id.in_(asset_ids)).all()
        
        print("\nChecking asset durations:")
        print("-" * 50)
        for asset in assets:
            print(f"\nAsset ID: {asset.id}")
            print(f"Title: {asset.title}")
            print(f"Duration: {asset.duration:.2f} seconds")
            print(f"Duration (formatted): {asset.duration_formatted}")
            print(f"File exists: {Path(asset.file_path).exists()}")
            print("-" * 50)

if __name__ == '__main__':
    check_durations() 