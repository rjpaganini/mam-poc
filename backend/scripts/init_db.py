"""Initialize a fresh database for the Media Asset Manager

IMPORTANT: This script will DELETE your existing database and create a new one!
Only use this script when you need a completely fresh start.

Common scenarios for using this script:
1. First-time setup: When you're setting up the project for the first time
2. Database corruption: If your database becomes corrupted and needs a reset
3. Schema changes: After major database structure changes that require a fresh start
4. Testing/Development: When you need a clean slate for testing new features

Workflow:
1. This script will DELETE the existing database at data/merged.db
2. Create a new, empty database with the latest schema
3. After running this, you must run scan_media.py to repopulate the database

Example usage:
```bash
# 1. Create fresh database
python backend/scripts/init_db.py

# 2. Scan media to populate the database
python backend/scripts/scan_media.py

# 3. Generate thumbnails
python backend/scripts/cleanup_thumbnails.py
```

WARNING: Running this script will erase all existing data! Make sure to:
1. Backup your existing database if needed
2. Inform other team members before running in production
3. Be prepared to rescan all media files
"""

from backend.app import create_app
from backend.app.database import db

def init_database():
    """Initialize a fresh, empty database
    
    This function:
    1. Connects to the database location (data/merged.db)
    2. Drops all existing tables (WARNING: destructive operation!)
    3. Creates new tables with the latest schema
    """
    # Create Flask app and push context
    app = create_app()
    app.app_context().push()
    
    print("Creating fresh database...")
    
    try:
        # Step 1: Drop existing tables (THIS DELETES ALL DATA!)
        db.drop_all()
        print("✓ Cleared existing database")
        
        # Step 2: Create new tables with latest schema
        db.create_all()
        print("✓ Created new tables")
        
        print("\nDatabase initialized successfully!")
        print("\nNext steps:")
        print("1. Run 'python backend/scripts/scan_media.py' to scan your media files")
        print("2. Run 'python backend/scripts/cleanup_thumbnails.py' to manage thumbnails")
        
    except Exception as e:
        print(f"\n❌ Error initializing database: {str(e)}")
        raise e

if __name__ == '__main__':
    init_database() 