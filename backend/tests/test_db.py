"""Test database functionality"""

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from pathlib import Path
import os

# Initialize Flask app
app = Flask(__name__)

# Configure database
data_dir = Path('data').resolve()
data_dir.mkdir(exist_ok=True)
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{data_dir}/mam.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database
db = SQLAlchemy(app)

# Define model
class MediaAsset(db.Model):
    """Media asset model with essential metadata"""
    __tablename__ = 'media_assets'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(1024), unique=True, nullable=False)
    file_size = db.Column(db.BigInteger, nullable=False)
    duration = db.Column(db.Float)  # Video duration in seconds
    width = db.Column(db.Integer)   # Video width in pixels
    height = db.Column(db.Integer)  # Video height in pixels
    codec = db.Column(db.String(50))

# Create tables
with app.app_context():
    db.create_all()
    print("Database tables created")
    
    # Test asset creation
    test_asset = MediaAsset(
        title="Test Video",
        file_path="/path/to/video.mp4",
        file_size=1024,
        duration=60.0,
        width=1920,
        height=1080,
        codec="h264"
    )
    db.session.add(test_asset)
    db.session.commit()
    print("Test asset created")
    
    # Verify asset
    asset = MediaAsset.query.first()
    print("\nTest Asset:")
    print(f"Title: {asset.title}")
    print(f"Path: {asset.file_path}")
    print(f"Size: {asset.file_size}")
    print(f"Duration: {asset.duration}")
    print(f"Resolution: {asset.width}x{asset.height}")
    print(f"Codec: {asset.codec}") 