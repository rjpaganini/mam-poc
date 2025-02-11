"""Video thumbnail generation utilities"""

import ffmpeg
from pathlib import Path
import logging
from typing import Optional
import os

logger = logging.getLogger(__name__)

def generate_thumbnail(video_path: Path, output_path: Path, time_offset: float = 7.0, size: tuple = (320, 180)) -> Optional[Path]:
    """
    Generate a thumbnail from a video file.
    
    Args:
        video_path: Path to source video file
        output_path: Path where thumbnail should be saved
        time_offset: Seconds into video to capture thumbnail (default: 7s - optimal for brand visibility)
        size: Thumbnail dimensions (width, height)
        
    Returns:
        Path to generated thumbnail if successful, None otherwise
    """
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
        
    except ffmpeg.Error as e:
        logger.error(f"FFmpeg error generating thumbnail for {video_path}: {e.stderr.decode()}")
        return None
    except Exception as e:
        logger.error(f"Error generating thumbnail for {video_path}: {e}")
        return None

def ensure_thumbnail(video_path: Path, thumbnails_dir: Path, asset_id: int) -> Optional[str]:
    """
    Ensure thumbnail exists for video, generate if missing.
    
    Args:
        video_path: Path to source video
        thumbnails_dir: Directory for thumbnails
        asset_id: Media asset ID for thumbnail filename
        
    Returns:
        Relative path to thumbnail if successful, None otherwise
    """
    try:
        # Define thumbnail path
        thumb_path = thumbnails_dir / f"{asset_id}.jpg"
        
        # Generate thumbnail if doesn't exist
        if not thumb_path.exists():
            if not generate_thumbnail(video_path, thumb_path):
                return None
                
        return str(thumb_path.relative_to(thumbnails_dir))
        
    except Exception as e:
        logger.error(f"Error ensuring thumbnail for asset {asset_id}: {e}")
        return None 