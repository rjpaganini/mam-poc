#!/usr/bin/env python3

import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app import create_app
from app.database import db
from app.models import MediaAsset
from app.utils.extract_metadata import generate_thumbnail

def generate_all_thumbnails():
    """Generate thumbnails for all video assets in the database."""
    app = create_app()
    with app.app_context():
        try:
            # Get all video assets
            assets = MediaAsset.query.all()
            video_assets = [asset for asset in assets if asset.mime_type and asset.mime_type.startswith('video/')]
            
            print(f"Found {len(video_assets)} video assets")
            
            for asset in video_assets:
                print(f"Generating thumbnail for {asset.title}...")
                
                try:
                    # Generate thumbnail
                    thumbnail_path = generate_thumbnail(asset.file_path)
                    if thumbnail_path:
                        # Initialize media_metadata if None
                        if asset.media_metadata is None:
                            asset.media_metadata = {}
                        else:
                            # Make a copy of the existing metadata to ensure it's mutable
                            asset.media_metadata = dict(asset.media_metadata)
                            
                        # Use the correct URL format for thumbnails (without /api prefix)
                        thumbnail_filename = os.path.basename(thumbnail_path)
                        asset.media_metadata['thumbnail_url'] = f"/thumbnails/{thumbnail_filename}"
                        
                        # Save to database
                        try:
                            db.session.add(asset)  # Ensure the asset is tracked
                            db.session.commit()
                            print(f"✓ Generated and saved thumbnail URL: {asset.media_metadata['thumbnail_url']}")
                        except Exception as e:
                            print(f"✗ Failed to update database for {asset.title}: {str(e)}")
                            db.session.rollback()
                    else:
                        print(f"✗ Failed to generate thumbnail for {asset.title}")
                        
                except Exception as e:
                    print(f"✗ Error processing {asset.title}: {str(e)}")
                    db.session.rollback()
                    continue
                    
        except Exception as e:
            print(f"✗ Fatal error: {str(e)}")
            db.session.rollback()
            raise

if __name__ == "__main__":
    generate_all_thumbnails() 