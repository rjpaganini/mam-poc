from backend.app.database import init_db, db_session
from backend.app.models import MediaAsset
import os
from pathlib import Path

def test_database():
    """Test database connection and operations."""
    print("Starting database test...")
    
    try:
        # Initialize database
        print("Initializing database...")
        init_db()
        
        # Check if database file was created
        db_path = Path('data/mam.db')
        print(f"Database path: {db_path.absolute()}")
        print(f"Database exists: {db_path.exists()}")
        
        # Create a test record
        print("\nCreating test record...")
        test_asset = MediaAsset(
            filename="test.mp4",
            filepath="/media/test.mp4",
            filetype="video/mp4",
            filesize=10.5
        )
        
        # Add to database
        print("Adding test record to database...")
        db = db_session()
        db.add(test_asset)
        db.commit()
        
        # Query to verify
        print("\nQuerying database...")
        asset = db.query(MediaAsset).first()
        if asset:
            print(f"Found test asset: {asset.to_dict()}")
        else:
            print("No asset found in database!")
        
        # Clean up
        print("\nCleaning up test data...")
        db.delete(asset)
        db.commit()
        
        print("\n✅ Database test completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Database test failed: {str(e)}")
        raise e
    finally:
        db_session.remove()

if __name__ == "__main__":
    test_database()