# process_directory.py
# Process media files in a directory

from pathlib import Path
from flask import current_app
from ..models import MediaAsset, db
from ..config import Config
from .extract_metadata import extract_metadata
from .thumbnail import ensure_thumbnail
from typing import List, Dict, Optional

def process_directory(directory_path: str, directory_id: Optional[int] = None) -> List[Dict]:
    """Process all media files in a directory and extract their metadata."""
    try:
        assets = []
        path = Path(directory_path).resolve()
        
        if not path.exists():
            current_app.logger.error(f"Directory not found: {directory_path}")
            return assets
            
        for file_path in path.rglob('*'):
            if file_path.is_file() and file_path.suffix.lower() in Config.ALLOWED_EXTENSIONS:
                try:
                    current_app.logger.info(f"Processing {file_path}")
                    
                    # Extract metadata first
                    metadata = extract_metadata(file_path)
                    if not metadata:
                        continue
                    
                    # Create asset record
                    asset = MediaAsset()
                    asset.title = file_path.stem
                    asset.file_path = str(file_path.absolute())
                    asset.file_size = metadata['file_size']
                    asset.duration = metadata.get('duration')
                    asset.width = metadata.get('width')
                    asset.height = metadata.get('height')
                    asset.codec = metadata.get('codec')
                    
                    # Add to session to get ID
                    db.session.add(asset)
                    db.session.flush()
                    
                    # Generate thumbnail
                    thumb_path = ensure_thumbnail(file_path, Config.THUMBNAIL_DIR, asset.id)
                    
                    # Commit changes
                    db.session.commit()
                    current_app.logger.info(f"Added to database: {asset.title}")
                    assets.append(asset.to_dict())
                    
                except Exception as e:
                    current_app.logger.error(f"Error processing {file_path}: {str(e)}")
                    db.session.rollback()
                    continue
                    
        return assets
        
    except Exception as e:
        current_app.logger.error(f"Error processing directory {directory_path}: {str(e)}")
        return []