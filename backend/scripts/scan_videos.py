"""Scan videos and generate thumbnails"""

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from pathlib import Path
import ffmpeg
import os
import logging
from typing import Dict, Any, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Configure paths
data_dir = Path('data').resolve()
thumbnails_dir = data_dir / 'thumbnails'
data_dir.mkdir(exist_ok=True)
thumbnails_dir.mkdir(exist_ok=True)

# Configure database
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{data_dir}/mam.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Media directory
MEDIA_PATH = Path('/Users/rjpaganini/Library/CloudStorage/GoogleDrive-rjpaganini@gmail.com/My Drive/Business/Valen Media/valn.io/exploration/valn.io/Data/Raw_Videos')
ALLOWED_EXTENSIONS = {'.mp4', '.mov', '.avi'}

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

def format_filesize_mb(bytes: int) -> float:
    """Convert bytes to megabytes with 2 decimal precision"""
    return round(bytes / (1024 * 1024), 2)

def format_fps(fps_str: str) -> float:
    """Convert ffmpeg fps string (e.g., '24000/1001') to decimal with 2 precision"""
    try:
        if '/' in fps_str:
            num, den = map(int, fps_str.split('/'))
            return round(num / den, 2)
        return round(float(fps_str), 2)
    except (ValueError, ZeroDivisionError):
        return 0.0

def format_duration(seconds: float) -> str:
    """Format duration as HH:MM:SS"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"

def extract_metadata(path: Path) -> Dict[str, Any]:
    """Extract comprehensive metadata from media file"""
    try:
        # Basic file info
        stat = path.stat()
        metadata = {
            'file_size': stat.st_size,
            'file_size_mb': format_filesize_mb(stat.st_size),
            'format': path.suffix.lower().lstrip('.'),  # e.g., 'mp4', 'mov'
            'last_modified': stat.st_mtime
        }
            
        # Extract video metadata using ffmpeg
        probe = ffmpeg.probe(str(path))
        format_info = probe.get('format', {})
        video_stream = next(
            (stream for stream in probe['streams'] if stream['codec_type'] == 'video'),
            None
        )
        
        if video_stream:
            # Get raw duration and calculate formatted version
            duration = float(format_info.get('duration', 0))
            
            metadata.update({
                'width': int(video_stream.get('width', 0)),
                'height': int(video_stream.get('height', 0)),
                'duration': duration,
                'duration_formatted': format_duration(duration),
                'codec': video_stream.get('codec_name', ''),  # e.g., 'h264'
                'fps': format_fps(video_stream.get('r_frame_rate', '0')),
                'bit_rate': int(format_info.get('bit_rate', 0)),
                'container_format': format_info.get('format_name', '').split(',')[0]  # e.g., 'mov,mp4,m4a,3gp,3g2,mj2' -> 'mov'
            })
                
        return metadata
        
    except Exception as e:
        logger.error(f"Metadata extraction failed for {path}: {e}")
        return {}

def generate_thumbnail(video_path: Path, output_path: Path, time_offset: float = 1.0, size: tuple = (320, 180)) -> Optional[Path]:
    """Generate a thumbnail from a video file"""
    try:
        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Remove existing thumbnail if any
        if output_path.exists():
            os.remove(output_path)
        
        # Generate thumbnail using ffmpeg
        stream = ffmpeg.input(str(video_path), ss=time_offset)
        stream = ffmpeg.filter(stream, 'scale', size[0], size[1])
        stream = ffmpeg.output(stream, str(output_path), vframes=1)
        
        # Run ffmpeg command silently
        ffmpeg.run(stream, capture_stdout=True, capture_stderr=True)
        
        if output_path.exists() and output_path.stat().st_size > 0:
            logger.info(f"Generated thumbnail for {video_path.name}")
            return output_path
            
        logger.error(f"Thumbnail generation failed: Output file empty or missing")
        return None
        
    except Exception as e:
        logger.error(f"Error generating thumbnail for {video_path}: {e}")
        return None

# Scan media files
with app.app_context():
    # Recreate tables
    db.drop_all()
    db.create_all()
    logger.info("Database initialized")
    
    # Scan directory
    new_files = 0
    for ext in ALLOWED_EXTENSIONS:
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
                thumb_path = thumbnails_dir / f"{asset.id}.jpg"
                if generate_thumbnail(file_path, thumb_path):
                    asset.thumbnail_path = f"{asset.id}.jpg"
                
                new_files += 1
                logger.info(f"Added: {file_path.name}")
                
            except Exception as e:
                logger.error(f"Error processing {file_path}: {e}")
                continue
    
    # Commit changes
    if new_files > 0:
        db.session.commit()
        logger.info(f"\nScan complete. Added {new_files} new files.")
    else:
        logger.info("\nNo new files found.")
        
    # Verify assets
    logger.info("\nVerifying assets in database:")
    assets = MediaAsset.query.all()
    for asset in assets:
        logger.info(f"\nAsset: {asset.title}")
        logger.info(f"Format: {asset.format} ({asset.container_format})")
        logger.info(f"Codec: {asset.codec}")
        logger.info(f"Size: {asset.file_size_mb:.2f} MB")
        logger.info(f"Duration: {asset.duration_formatted}")
        logger.info(f"Resolution: {asset.width}x{asset.height}")
        logger.info(f"FPS: {asset.fps:.2f}")
        logger.info(f"Bit Rate: {asset.bit_rate:,} bps")
        if asset.thumbnail_path:
            logger.info(f"Thumbnail: {asset.thumbnail_path}") 