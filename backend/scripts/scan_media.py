"""Scan media files and add to database"""

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from pathlib import Path
from backend.app.utils.extract_metadata import extract_metadata
from backend.app.utils.thumbnail import ensure_thumbnail
from backend.app.config import Config  # Import Config class
import os
from datetime import datetime

# Initialize Flask app
app = Flask(__name__)

# Configure paths using Config class
data_dir = Config.DATA_DIR
thumbnails_dir = Config.THUMBNAIL_DIR
data_dir.mkdir(exist_ok=True)
thumbnails_dir.mkdir(exist_ok=True)

# Configure database
app.config['SQLALCHEMY_DATABASE_URI'] = Config.SQLALCHEMY_DATABASE_URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Media directory from Config
MEDIA_PATH = Config.MEDIA_PATH

# Initialize database
db = SQLAlchemy(app)

class MediaAsset(db.Model):
    """Media asset model with essential metadata"""
    __tablename__ = 'media_assets'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(1024), unique=True, nullable=False)
    file_size = db.Column(db.BigInteger, nullable=False)
    file_size_mb = db.Column(db.Float, nullable=False)  # Size in MB
    format = db.Column(db.String(10), nullable=False)   # e.g., 'mp4', 'mov'
    duration = db.Column(db.Float)                      # Duration in seconds
    duration_formatted = db.Column(db.String(10))       # e.g., '02:30'
    width = db.Column(db.Integer)                       # Video width in pixels
    height = db.Column(db.Integer)                      # Video height in pixels
    fps = db.Column(db.Float)                          # Frames per second
    codec = db.Column(db.String(50))                   # e.g., 'h264'
    container_format = db.Column(db.String(50))        # e.g., 'mov', 'mp4'
    bit_rate = db.Column(db.BigInteger)                # Bits per second
    thumbnail_path = db.Column(db.String(255))         # Relative path to thumbnail
    created_at = db.Column(db.DateTime, default=datetime.utcnow)  # Creation timestamp
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # Update timestamp

# Scan media files
with app.app_context():
    # Recreate tables
    db.drop_all()
    db.create_all()
    print("Database initialized")
    
    # Scan directory
    new_files = 0
    for ext in Config.ALLOWED_EXTENSIONS:  # Use Config.ALLOWED_EXTENSIONS
        for file_path in MEDIA_PATH.glob(f"**/*{ext}"):
            try:
                # Extract metadata
                metadata = extract_metadata(file_path)
                if not metadata:
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
                    bit_rate=metadata.get('bit_rate')
                )
                
                # Add to database to get ID
                db.session.add(asset)
                db.session.flush()
                
                # Generate thumbnail
                thumb_path = ensure_thumbnail(file_path, thumbnails_dir, asset.id)
                if thumb_path:
                    asset.thumbnail_path = thumb_path
                
                new_files += 1
                print(f"Added: {file_path.name}")
                
            except Exception as e:
                print(f"Error processing {file_path}: {e}")
                continue
    
    # Commit changes
    if new_files > 0:
        db.session.commit()
        print(f"\nScan complete. Added {new_files} new files.")
    else:
        print("\nNo new files found.")
        
    # Verify assets
    print("\nVerifying assets in database:")
    assets = MediaAsset.query.all()
    for asset in assets:
        print(f"\nAsset: {asset.title}")
        print(f"Path: {asset.file_path}")
        print(f"Format: {asset.format} ({asset.container_format})")
        print(f"Codec: {asset.codec}")
        print(f"Size: {asset.file_size_mb:.2f} MB")
        print(f"Duration: {asset.duration_formatted}")
        print(f"Resolution: {asset.width}x{asset.height}")
        print(f"FPS: {asset.fps:.2f}")
        print(f"Bit Rate: {asset.bit_rate:,} bps")
        if asset.thumbnail_path:
            print(f"Thumbnail: {asset.thumbnail_path}") 