# process_directory.py
# Process media files in a directory

from pathlib import Path
from flask import current_app
from ..models import MediaAsset
from ..database import db
from ..config import SUPPORTED_EXTENSIONS
from .extract_metadata import extract_metadata
from typing import List, Dict

def process_directory(directory_path: str, directory_id: int = None) -> List[Dict]:
    """Process all media files in a directory and extract their metadata."""
    try:
        assets = []
        path = Path(directory_path).resolve()
        
        if not path.exists():
            current_app.logger.error(f"Directory not found: {directory_path}")
            return assets
            
        for file_path in path.rglob('*'):
            if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_EXTENSIONS:
                try:
                    current_app.logger.info(f"Processing {file_path}")
                    metadata = extract_metadata(str(file_path))
                    
                    if not metadata:
                        continue
                        
                    asset = MediaAsset(
                        title=file_path.stem,
                        file_path=str(file_path.absolute()),
                        file_size=metadata.get('file_size', 0),
                        mime_type=metadata.get('mime_type', 'application/octet-stream'),
                        media_metadata=metadata,
                        directory_id=directory_id
                    )
                    
                    db.session.add(asset)
                    db.session.commit()
                    current_app.logger.info(f"Added to database: {asset.title}")
                    assets.append(asset.to_dict())
                    
                except Exception as e:
                    current_app.logger.error(f"Error processing {file_path}: {str(e)}")
                    db.session.rollback()
                    continue
                    
        return assets
        
    except Exception as e:
        current_app.logger.error(f"Error scanning directory: {str(e)}")
        return [] 