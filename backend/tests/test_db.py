"""Test database functionality"""

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from pathlib import Path
import os
from datetime import datetime

# Initialize Flask app
app = Flask(__name__)

# Configure test database to use in-memory SQLite
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'  # Use in-memory database for tests
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Create tables
with app.app_context():
    db.create_all()
    print("Database tables created")
    
    # Test asset creation with all required fields
    test_asset = MediaAsset(
        title="Test Video",
        file_path="/path/to/video.mp4",
        file_size=1024,
        file_size_mb=1.0,
        format="mp4",
        duration=60.0,
        duration_formatted="00:01:00",
        width=1920,
        height=1080,
        fps=30.0,
        codec="h264",
        container_format="mp4",
        bit_rate=2000000
    )
    db.session.add(test_asset)
    db.session.commit()
    print("Test asset created")
    
    # Verify asset
    asset = MediaAsset.query.first()
    print("\nTest Asset:")
    print(f"Title: {asset.title}")
    print(f"Path: {asset.file_path}")
    print(f"Size: {asset.file_size_mb} MB")
    print(f"Format: {asset.format}")
    print(f"Duration: {asset.duration_formatted}")
    print(f"Resolution: {asset.width}x{asset.height}")
    print(f"Codec: {asset.codec}")
    print(f"FPS: {asset.fps}")
    print(f"Container: {asset.container_format}")
    print(f"Bit Rate: {asset.bit_rate} bps") 