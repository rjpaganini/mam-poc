"""Video thumbnail generation utilities"""

import ffmpeg
from pathlib import Path
import logging
from typing import Optional
import os

logger = logging.getLogger(__name__)

def generate_thumbnail(video_path: Path, output_path: Path, size: tuple = (320, 180)) -> Optional[Path]:
    """
    Generate a thumbnail from a video file at 5 seconds.
    
    Args:
        video_path: Path to source video file
        output_path: Path where thumbnail should be saved
        size: Thumbnail dimensions (width, height)
        
    Returns:
        Path to generated thumbnail if successful, None otherwise
    """
    try:
        # Log the attempt
        logger.info(f"Attempting to generate thumbnail for {video_path}")
        logger.info(f"Output path: {output_path}")
        
        # Validate video file
        if not video_path.exists():
            logger.error(f"Video file does not exist: {video_path}")
            return None
            
        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Remove existing thumbnail if any
        if output_path.exists():
            logger.info(f"Removing existing thumbnail: {output_path}")
            os.remove(output_path)
        
        # Get video duration first
        probe = ffmpeg.probe(str(video_path))
        duration = float(probe['format']['duration'])
        
        # Use 5 seconds or video midpoint if duration < 5 seconds
        timestamp = min(5.0, duration / 2)
        logger.info(f"Using timestamp {timestamp}s for video duration {duration}s")
        
        # Generate thumbnail using ffmpeg
        stream = ffmpeg.input(str(video_path))
        stream = ffmpeg.filter(stream, 'select', 'gte(t,{})'.format(timestamp))
        stream = ffmpeg.filter(stream, 'scale', size[0], size[1], force_original_aspect_ratio='decrease')
        stream = ffmpeg.filter(stream, 'pad', size[0], size[1], '(ow-iw)/2', '(oh-ih)/2')
        stream = ffmpeg.filter(stream, 'format', 'yuvj420p')
        stream = ffmpeg.output(
            stream, 
            str(output_path), 
            vframes=1,
            strict='unofficial',
            q=2
        )
        
        # Run ffmpeg command with logging
        logger.info("Running FFmpeg command...")
        ffmpeg.run(stream, capture_stdout=True, capture_stderr=True, overwrite_output=True)
        
        if output_path.exists() and output_path.stat().st_size > 0:
            logger.info(f"Successfully generated thumbnail: {output_path}")
            # Set permissions to ensure readability
            os.chmod(output_path, 0o644)
            return output_path
            
        logger.error(f"Thumbnail generation failed: Output file empty or missing")
        return None
        
    except ffmpeg.Error as e:
        logger.error(f"FFmpeg error generating thumbnail for {video_path}:")
        logger.error(f"stdout: {e.stdout.decode() if e.stdout else 'None'}")
        logger.error(f"stderr: {e.stderr.decode() if e.stderr else 'None'}")
        return None
    except Exception as e:
        logger.error(f"Error generating thumbnail for {video_path}: {str(e)}")
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
        # Define thumbnail path using asset ID
        thumb_path = thumbnails_dir / f"{asset_id}.jpg"
        
        # Generate thumbnail if doesn't exist
        if not thumb_path.exists():
            logger.info(f"Thumbnail missing for asset {asset_id}, generating...")
            if not generate_thumbnail(video_path, thumb_path):
                return None
                
        return str(thumb_path.relative_to(thumbnails_dir))
        
    except Exception as e:
        logger.error(f"Error ensuring thumbnail for asset {asset_id}: {str(e)}")
        return None 