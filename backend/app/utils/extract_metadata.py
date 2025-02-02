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

def generate_thumbnail(video_path: str, output_path: str = None, max_retries: int = 3) -> str:
    """Generate a thumbnail from a video file using ffmpeg."""
    try:
        if output_path is None:
            # Create thumbnails directory in a consistent location relative to MEDIA_BASE_PATH
            media_base = os.getenv('MEDIA_BASE_PATH')
            if not media_base:
                current_app.logger.error("MEDIA_BASE_PATH not set")
                return None
                
            # Create thumbnails directory next to media directory
            thumbnails_dir = os.path.join(os.path.dirname(media_base), 'thumbnails')
            try:
                os.makedirs(thumbnails_dir, exist_ok=True)
                current_app.logger.info(f"Using thumbnails directory: {thumbnails_dir}")
            except Exception as e:
                current_app.logger.error(f"Failed to create thumbnails directory: {str(e)}")
                return None
            
            # Generate thumbnail path
            filename = os.path.splitext(os.path.basename(video_path))[0]
            output_path = os.path.join(thumbnails_dir, f"{filename}_thumb.jpg")
        
        # Retry loop for ffmpeg
        last_error = None
        for attempt in range(max_retries):
            try:
                # Use ffmpeg to extract a frame at 0.1 seconds
                result = subprocess.run([
                    'ffmpeg', '-y', '-i', video_path,
                    '-ss', '0.1',
                    '-vframes', '1',
                    '-vf', 'scale=480:-1',
                    output_path
                ], check=True, capture_output=True, text=True)
                
                # Validate the generated thumbnail
                if os.path.exists(output_path):
                    file_size = os.path.getsize(output_path)
                    if file_size < 100:  # Less than 100 bytes is probably corrupted
                        current_app.logger.error(f"Generated thumbnail is too small: {file_size} bytes")
                        os.remove(output_path)  # Clean up corrupted file
                        continue
                        
                    current_app.logger.info(f"Successfully generated thumbnail: {output_path}")
                    return output_path
                else:
                    current_app.logger.error("Thumbnail file not created despite successful ffmpeg run")
                    continue
                    
            except subprocess.CalledProcessError as e:
                last_error = e
                current_app.logger.error(f"FFmpeg failed (attempt {attempt + 1}/{max_retries}): {e.stderr}")
                if os.path.exists(output_path):
                    os.remove(output_path)  # Clean up any partial file
                if attempt < max_retries - 1:
                    continue
                return None
                
        if last_error:
            current_app.logger.error(f"All ffmpeg attempts failed: {last_error.stderr}")
        return None
            
    except Exception as e:
        current_app.logger.error(f"Error generating thumbnail for {video_path}: {str(e)}", exc_info=True)
        if output_path and os.path.exists(output_path):
            os.remove(output_path)  # Clean up any partial file
        return None

def extract_metadata(file_path: str) -> Dict[str, Any]:
    """Extract metadata from a media file."""
    try:
        path = Path(file_path)
        mime = magic.Magic(mime=True)
        mime_type = mime.from_file(str(path))
        file_size = path.stat().st_size / (1024 * 1024)  # Convert to MB
        
        metadata = {
            'file_size': round(file_size, 2),
            'mime_type': mime_type,
            'last_modified': datetime.fromtimestamp(path.stat().st_mtime).isoformat(),
            'file_extension': path.suffix.lower(),
            'creation_date': datetime.fromtimestamp(path.stat().st_ctime).isoformat()
        }
        
        if mime_type.startswith('video/'):
            video_metadata = extract_video_metadata(file_path)
            metadata.update(video_metadata)
            
            # Generate thumbnail for video
            thumbnail_path = generate_thumbnail(file_path)
            if thumbnail_path:
                metadata['thumbnail_url'] = f"/thumbnails/{os.path.basename(thumbnail_path)}"
                
        elif mime_type.startswith('image/'):
            image_metadata = extract_image_metadata(file_path)
            metadata.update(image_metadata)
        elif mime_type.startswith('audio/'):
            audio_metadata = extract_audio_metadata(file_path)
            metadata.update(audio_metadata)
            
        return metadata
        
    except Exception as e:
        current_app.logger.error(f"Error extracting metadata from {file_path}: {str(e)}")
        return {}

def extract_video_metadata(file_path: str) -> dict:
    """Extract metadata from video files using ffmpeg."""
    try:
        probe = ffmpeg.probe(file_path)
        metadata = {}
        
        video_stream = next((stream for stream in probe['streams'] if stream['codec_type'] == 'video'), None)
        if video_stream:
            metadata.update({
                'width': int(video_stream.get('width', 0)),
                'height': int(video_stream.get('height', 0)),
                'duration': float(probe['format'].get('duration', 0)),
                'bitrate': int(probe['format'].get('bit_rate', 0)),
                'codec': video_stream.get('codec_name', ''),
                'fps': eval(video_stream.get('r_frame_rate', '0/1'))
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
