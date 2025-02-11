# extract_metadata.py
"""
Metadata extraction for media files.
Uses the enhanced merged database schema for storage.
Includes support for future AI processing metadata.
"""

import os
from pathlib import Path
import ffmpeg
from PIL import Image
from typing import Dict, Any, Optional
import logging
from datetime import datetime
from .db_utils import update_asset_metadata

logger = logging.getLogger(__name__)

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
        logger.warning(f"Invalid FPS value: {fps_str}")
        return 0.0

def format_duration(seconds: float) -> str:
    """Format duration as HH:MM:SS"""
    try:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{secs:02d}"
        return f"{minutes:02d}:{secs:02d}"
    except Exception as e:
        logger.warning(f"Duration formatting failed: {e}")
        return "00:00"

def extract_metadata(path: Path, asset_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Extract comprehensive metadata from media file and update database.
    Includes preparation for future AI processing metadata.
    
    Args:
        path: Path to media file
        asset_id: Optional ID of existing asset in database
        
    Returns:
        Dict containing extracted metadata
    """
    try:
        # Basic file info
        stat = path.stat()
        metadata = {
            'file_size': stat.st_size,
            'file_size_mb': format_filesize_mb(stat.st_size),
            'format': path.suffix.lower().lstrip('.'),
            'created_at': datetime.utcnow().isoformat()
        }
            
        # Extract video metadata using ffmpeg
        probe = ffmpeg.probe(str(path))
        format_info = probe.get('format', {})
        
        # Get video stream with fallback values
        video_stream = next(
            (stream for stream in probe['streams'] if stream['codec_type'] == 'video'),
            {}
        )
        
        # Get audio stream with fallback values
        audio_stream = next(
            (stream for stream in probe['streams'] if stream['codec_type'] == 'audio'),
            {}
        )
        
        # Always include video metadata with fallbacks
        duration = float(format_info.get('duration', 0))
        metadata.update({
            'width': int(video_stream.get('width', 0)),
            'height': int(video_stream.get('height', 0)),
            'duration': duration,
            'duration_formatted': format_duration(duration),
            'codec': video_stream.get('codec_name', 'unknown'),
            'fps': format_fps(video_stream.get('r_frame_rate', '0')),
            'bit_rate': int(format_info.get('bit_rate', 0)),
            'container_format': format_info.get('format_name', '').split(',')[0],
            # Audio metadata with fallbacks
            'audio_codec': audio_stream.get('codec_name', 'none'),
            'audio_channels': int(audio_stream.get('channels', 0)),
            'audio_sample_rate': int(audio_stream.get('sample_rate', 0)),
            # Prepare for future AI processing
            'ai_processed': False,
            'ai_version': None,
            'ai_models': [],
            'processing_status': 'pending'
        })
                
        # Update database if asset_id provided
        if asset_id:
            update_asset_metadata(asset_id, metadata)
            logger.info(f"Updated metadata for asset {asset_id}")
            
        return metadata
        
    except Exception as e:
        logger.error(f"Metadata extraction failed for {path}: {e}")
        # Return minimal metadata instead of empty dict
        return {
            'file_size': 0,
            'file_size_mb': 0,
            'format': path.suffix.lower().lstrip('.'),
            'duration': 0,
            'duration_formatted': '00:00',
            'width': 0,
            'height': 0,
            'codec': 'unknown',
            'created_at': datetime.utcnow().isoformat(),
            'error': str(e)
        }
