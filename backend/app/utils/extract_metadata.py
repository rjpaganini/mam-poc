# extract_metadata.py
# This file contains functions to extract metadata from media files.

import os
from pathlib import Path
from datetime import datetime
import magic
import ffmpeg
from PIL import Image
import subprocess
from flask import current_app
from typing import Dict, Any
import logging

# Configure logging
logger = logging.getLogger(__name__)

def generate_thumbnail(video_path: str, output_path: str = None, max_retries: int = 3) -> str:
    """Generate a thumbnail from a video file using ffmpeg at 6 seconds mark."""
    try:
        logger.info(f"Starting thumbnail generation for: {video_path}")
        
        if output_path is None:
            # Create thumbnails directory in a consistent location relative to MEDIA_BASE_PATH
            media_base = os.getenv('MEDIA_BASE_PATH')
            if not media_base:
                logger.error("MEDIA_BASE_PATH not set")
                return None
                
            # Create thumbnails directory next to media directory
            thumbnails_dir = os.path.join(os.path.dirname(media_base), 'thumbnails')
            try:
                os.makedirs(thumbnails_dir, exist_ok=True)
                logger.info(f"Using thumbnails directory: {thumbnails_dir}")
            except Exception as e:
                logger.error(f"Failed to create thumbnails directory: {str(e)}")
                return None
            
            # Generate thumbnail path
            filename = os.path.splitext(os.path.basename(video_path))[0]
            output_path = os.path.join(thumbnails_dir, f"{filename}_thumb.jpg")
            logger.info(f"Thumbnail will be saved as: {output_path}")
        
        # Retry loop for ffmpeg
        last_error = None
        for attempt in range(max_retries):
            try:
                logger.info(f"Attempt {attempt + 1}/{max_retries} to generate thumbnail")
                
                # Use ffmpeg to extract a frame at 6 seconds
                # Note: -ss before -i for more accurate seeking
                ffmpeg_cmd = [
                    'ffmpeg', '-y',
                    '-ss', '6',  # Seek to 6 seconds (before input for accuracy)
                    '-i', video_path,
                    '-vframes', '1',
                    '-vf', 'scale=480:-1',  # Scale width to 480px, maintain aspect ratio
                    '-q:v', '2',  # High quality (2-31, lower is better)
                    output_path
                ]
                logger.info(f"Running ffmpeg command: {' '.join(ffmpeg_cmd)}")
                
                result = subprocess.run(ffmpeg_cmd, check=True, capture_output=True, text=True)
                logger.debug(f"FFmpeg output: {result.stdout}")
                
                # Validate the generated thumbnail
                if os.path.exists(output_path):
                    file_size = os.path.getsize(output_path)
                    if file_size < 100:  # Less than 100 bytes is probably corrupted
                        logger.error(f"Generated thumbnail is too small: {file_size} bytes")
                        os.remove(output_path)  # Clean up corrupted file
                        continue
                        
                    logger.info(f"Successfully generated thumbnail: {output_path} ({file_size} bytes)")
                    return output_path
                else:
                    logger.error("Thumbnail file not created despite successful ffmpeg run")
                    continue
                    
            except subprocess.CalledProcessError as e:
                last_error = e
                logger.error(f"FFmpeg failed (attempt {attempt + 1}/{max_retries}): {e.stderr}")
                if os.path.exists(output_path):
                    os.remove(output_path)  # Clean up any partial file
                if attempt < max_retries - 1:
                    continue
                return None
                
        if last_error:
            logger.error(f"All ffmpeg attempts failed: {last_error.stderr}")
        return None
            
    except Exception as e:
        logger.error(f"Error generating thumbnail for {video_path}: {str(e)}", exc_info=True)
        if output_path and os.path.exists(output_path):
            os.remove(output_path)  # Clean up any partial file
        return None

def extract_metadata(file_path: str) -> Dict[str, Any]:
    """Extract metadata from a media file."""
    try:
        logger.info(f"Extracting metadata for: {file_path}")
        path = Path(file_path)
        mime = magic.Magic(mime=True)
        mime_type = mime.from_file(str(path))
        file_size = path.stat().st_size  # Store raw bytes
        
        metadata = {
            'file_size': file_size,  # Store raw bytes
            'mime_type': mime_type,
            'last_modified': datetime.fromtimestamp(path.stat().st_mtime).isoformat(),
            'file_extension': path.suffix.lower(),
            'creation_date': datetime.fromtimestamp(path.stat().st_ctime).isoformat()
        }
        
        if mime_type.startswith('video/'):
            # Generate thumbnail during metadata extraction
            thumbnail_path = generate_thumbnail(str(path))
            if thumbnail_path:
                metadata['thumbnail_url'] = f"/thumbnails/{os.path.basename(thumbnail_path)}"
                metadata['thumbnail_timestamp'] = 6  # Store the timestamp directly in metadata
                logger.info(f"Added thumbnail to metadata: {metadata['thumbnail_url']}")
            else:
                logger.warning(f"Failed to generate thumbnail for {file_path}")
            
            # Add video-specific metadata
            video_metadata = extract_video_metadata(str(path))
            metadata.update(video_metadata)
        
        logger.info(f"Successfully extracted metadata for: {file_path}")
        return metadata
        
    except Exception as e:
        logger.error(f"Error extracting metadata for {file_path}: {str(e)}", exc_info=True)
        return None

def extract_video_metadata(file_path: str) -> dict:
    """Extract metadata from video files using ffmpeg."""
    try:
        probe = ffmpeg.probe(file_path)
        metadata = {}
        
        video_stream = next((stream for stream in probe['streams'] if stream['codec_type'] == 'video'), None)
        if video_stream:
            # Calculate precise frame rate from the fraction
            r_frame_rate = video_stream.get('r_frame_rate', '0/1')
            try:
                num, den = map(float, r_frame_rate.split('/'))
                fps = num / den if den != 0 else 0
            except (ValueError, ZeroDivisionError):
                fps = 0
                
            metadata.update({
                'width': int(video_stream.get('width', 0)),
                'height': int(video_stream.get('height', 0)),
                'duration': float(probe['format'].get('duration', 0)),
                'bitrate': int(probe['format'].get('bit_rate', 0)),
                'codec': video_stream.get('codec_name', ''),
                'fps': round(fps, 3)  # Keep 3 decimal places for precision
            })
            
        audio_stream = next((stream for stream in probe['streams'] if stream['codec_type'] == 'audio'), None)
        if audio_stream:
            metadata['audio'] = {
                'codec': audio_stream.get('codec_name', ''),
                'channels': int(audio_stream.get('channels', 0)),
                'sample_rate': int(audio_stream.get('sample_rate', 0))
            }
            
        return metadata
        
    except Exception as e:
        current_app.logger.error(f"Error extracting video metadata from {file_path}: {str(e)}")
        return {}

def extract_image_metadata(file_path: str) -> dict:
    """Extract metadata from image files."""
    try:
        with Image.open(file_path) as img:
            return {
                'width': img.width,
                'height': img.height,
                'format': img.format,
                'mode': img.mode
            }
    except Exception as e:
        current_app.logger.error(f"Error extracting image metadata from {file_path}: {str(e)}")
        return {}

def extract_audio_metadata(file_path: str) -> dict:
    """Extract metadata from audio files using ffmpeg."""
    try:
        probe = ffmpeg.probe(file_path)
        metadata = {}
        
        audio_stream = next((stream for stream in probe['streams'] if stream['codec_type'] == 'audio'), None)
        if audio_stream:
            metadata.update({
                'duration': float(probe['format'].get('duration', 0)),
                'bitrate': int(probe['format'].get('bit_rate', 0)),
                'codec': audio_stream.get('codec_name', ''),
                'channels': int(audio_stream.get('channels', 0)),
                'sample_rate': int(audio_stream.get('sample_rate', 0))
            })
            
        return metadata
        
    except Exception as e:
        current_app.logger.error(f"Error extracting audio metadata from {file_path}: {str(e)}")
        return {}

if __name__ == "__main__":
    # Define the path to your dataset
    DATASET_PATH = os.path.expanduser("~/Library/CloudStorage/GoogleDrive-rjpaganini@gmail.com/My Drive/Business/Valen Media/valn.io/exploration/valn.io/Data/Raw_Videos")
    
    print("Starting metadata extraction...")
    try:
        assets = process_directory(DATASET_PATH)
        print(f"\nSuccessfully processed {len(assets)} assets:")
        for asset in assets:
            print(f"\nTitle: {asset['title']}")
            print(f"Path: {asset['file_path']}")
            print(f"Metadata: {asset['media_metadata']}")
    except Exception as e:
        print(f"Error during extraction: {str(e)}")
