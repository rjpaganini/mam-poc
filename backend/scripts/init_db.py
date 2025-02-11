"""Initialize database and scan media files"""

from pathlib import Path
from backend.app import create_app
from backend.app.database import db
from backend.app.models import MediaAsset
from backend.app.utils.extract_metadata import extract_metadata
from backend.app.config import Config

def init_database():
    """Initialize database and scan media directory"""
    # Create Flask app and push context
    app = create_app()
    app.app_context().push()
    
    # Recreate database
    db.drop_all()
    db.create_all()
    print("Database initialized")
    
    # Scan media directory
    media_dir = Path(Config.MEDIA_PATH)
    if not media_dir.exists():
        print(f"Media directory not found: {media_dir}")
        return
        
    new_files = 0
    for ext in Config.ALLOWED_EXTENSIONS:
        for file_path in media_dir.glob(f"**/*{ext}"):
            try:
                # Extract video metadata
                metadata = extract_metadata(file_path)
                
                # Create new asset
                asset = MediaAsset(
                    title=file_path.stem,
                    file_path=str(file_path),
                    file_size=file_path.stat().st_size,
                    duration=metadata.get('duration'),
                    width=metadata.get('width'),
                    height=metadata.get('height'),
                    codec=metadata.get('codec')
                )
                db.session.add(asset)
                new_files += 1
                print(f"Added: {file_path.name}")
                
            except Exception as e:
                print(f"Error processing {file_path}: {e}")
                continue
    
    if new_files > 0:
        db.session.commit()
        print(f"\nScan complete. Added {new_files} new files.")
    else:
        print("\nNo new files found.")

if __name__ == '__main__':
    init_database() 