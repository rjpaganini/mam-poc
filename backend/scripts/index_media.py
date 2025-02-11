# backend/scripts/index_media.py

import os
from pathlib import Path
from flask import Flask
from backend.app.database import db, init_db
from backend.app.models import MediaAsset
from backend.app.utils.extract_metadata import extract_metadata
from backend.app.config import GOOGLE_DRIVE_PATH

def create_app():
    """Create Flask app for script context."""
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///data/mam.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    init_db(app)
    return app

def index_media_files():
    """Index media files from Google Drive."""
    app = create_app()
    
    with app.app_context():
        try:
            # Get absolute path to Google Drive directory
            drive_path = os.path.expanduser(GOOGLE_DRIVE_PATH)
            if not os.path.exists(drive_path):
                print(f"Google Drive path not found: {drive_path}")
                return
            
            print(f"Indexing media files from: {drive_path}")
            
            # Process each file in the directory
            for root, _, files in os.walk(drive_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    try:
                        # Extract metadata
                        metadata = extract_metadata(file_path)
                        if not metadata:
                            continue
                        
                        # Create asset record
                        asset = MediaAsset(
                            title=Path(file).stem,
                            file_path=file_path,
                            file_name=file,
                            file_size=metadata['file_size'],
                            mime_type=metadata['mime_type'],
                            media_metadata=metadata
                        )
                        
                        # Add to database
                        db.session.add(asset)
                        db.session.commit()
                        print(f"Added to database: {asset.title}")
                        
                    except Exception as e:
                        print(f"Error processing {file}: {str(e)}")
                        db.session.rollback()
            
            print("Indexing complete")
            
        except Exception as e:
            print(f"Error during indexing: {str(e)}")
            db.session.rollback()

if __name__ == '__main__':
    index_media_files()