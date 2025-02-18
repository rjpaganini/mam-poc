#!/usr/bin/env python3
"""
Database Migration Script
Merges the best features of both databases:
- Normalized columns from newer DB (better query performance)
- Advanced features from older DB (tags, processing results)
- Enhanced metadata storage
"""

import sqlite3
import json
import shutil
from pathlib import Path
from datetime import datetime

# Path configuration
PROJECT_ROOT = Path(__file__).parent.parent
OLD_DB = PROJECT_ROOT / 'data/mam.db'
NEW_DB = PROJECT_ROOT / 'data/mam.db'
MERGED_DB = PROJECT_ROOT / 'data/merged.db'

def setup_merged_schema(cur):
    """Create enhanced schema combining best of both databases"""
    # Core media asset table with normalized columns
    cur.execute('''
    CREATE TABLE media_assets (
        id INTEGER PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        file_path VARCHAR(1024) NOT NULL UNIQUE,
        file_size BIGINT NOT NULL,
        file_size_mb FLOAT NOT NULL,
        format VARCHAR(10) NOT NULL,
        duration FLOAT,
        duration_formatted VARCHAR(10),
        width INTEGER,
        height INTEGER,
        fps FLOAT,
        codec VARCHAR(50),
        container_format VARCHAR(50),
        bit_rate BIGINT,
        audio_codec VARCHAR(50),
        audio_channels INTEGER,
        audio_sample_rate INTEGER,
        thumbnail_path VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        directory_id INTEGER,
        FOREIGN KEY(directory_id) REFERENCES media_directories(id) ON DELETE SET NULL
    )
    ''')

    # Media directories tracking
    cur.execute('''
    CREATE TABLE media_directories (
        id INTEGER PRIMARY KEY,
        path VARCHAR(1024) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        last_scanned DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Tags system
    cur.execute('CREATE TABLE tags (id INTEGER PRIMARY KEY, name VARCHAR(50) NOT NULL UNIQUE)')
    cur.execute('''
    CREATE TABLE asset_tags (
        asset_id INTEGER,
        tag_id INTEGER,
        PRIMARY KEY (asset_id, tag_id),
        FOREIGN KEY(asset_id) REFERENCES media_assets(id) ON DELETE CASCADE,
        FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
    ''')

    # AI/ML processing results
    cur.execute('''
    CREATE TABLE processing_results (
        id INTEGER PRIMARY KEY,
        asset_id INTEGER NOT NULL,
        processor_name VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL,
        result_data JSON,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(asset_id) REFERENCES media_assets(id) ON DELETE CASCADE
    )
    ''')

def migrate_data(old_cur, new_cur, merged_cur):
    """Migrate data from both databases to merged database"""
    print("Migrating media assets...")
    
    # Get data from both databases
    old_cur.execute("SELECT * FROM media_assets")
    old_assets = old_cur.fetchall()
    
    new_cur.execute("SELECT * FROM media_assets")
    new_assets = new_cur.fetchall()
    
    # Create a mapping of file paths to merged data
    merged_assets = {}
    
    # Process old database assets (with JSON metadata)
    for asset in old_assets:
        metadata = json.loads(asset[6]) if asset[6] else {}
        merged_assets[asset[3]] = {
            'title': asset[1],
            'description': asset[2],
            'file_path': asset[3],
            'file_size': asset[4],
            'file_size_mb': float(asset[4]) / (1024 * 1024),
            'format': Path(asset[3]).suffix[1:],
            'duration': metadata.get('duration'),
            'width': metadata.get('width'),
            'height': metadata.get('height'),
            'fps': metadata.get('fps'),
            'codec': metadata.get('codec'),
            'audio_codec': metadata.get('audio', {}).get('codec'),
            'audio_channels': metadata.get('audio', {}).get('channels'),
            'audio_sample_rate': metadata.get('audio', {}).get('sample_rate'),
            'created_at': asset[7],
            'directory_id': asset[9]
        }
    
    # Update/override with newer database info
    for asset in new_assets:
        file_path = asset[2]  # Assuming file_path is 3rd column in new DB
        if file_path in merged_assets:
            # Update existing entry with normalized data
            merged_assets[file_path].update({
                'file_size_mb': asset[3],  # Assuming these column positions
                'format': asset[4],
                'duration_formatted': asset[7],
                'bit_rate': asset[13]
            })
        else:
            # Add new entry
            merged_assets[file_path] = {
                'title': asset[1],
                'file_path': file_path,
                'file_size': int(asset[3] * 1024 * 1024),  # Convert MB to bytes
                'file_size_mb': asset[3],
                'format': asset[4],
                'duration': asset[6],
                'duration_formatted': asset[7],
                'width': asset[8],
                'height': asset[9],
                'fps': asset[10],
                'codec': asset[11],
                'container_format': asset[12],
                'bit_rate': asset[13],
                'created_at': datetime.utcnow().isoformat()
            }
    
    # Insert into merged database
    for asset_data in merged_assets.values():
        placeholders = ', '.join(['?' for _ in asset_data])
        columns = ', '.join(asset_data.keys())
        merged_cur.execute(
            f"INSERT INTO media_assets ({columns}) VALUES ({placeholders})",
            list(asset_data.values())
        )

def main():
    """Main migration function"""
    print(f"Starting database migration...")
    
    # Backup existing databases
    backup_time = datetime.now().strftime('%Y%m%d_%H%M%S')
    if OLD_DB.exists():
        shutil.copy(OLD_DB, OLD_DB.parent / f"mam.db.bak_{backup_time}")
    if NEW_DB.exists():
        shutil.copy(NEW_DB, NEW_DB.parent / f"mam.db.bak_{backup_time}")
    
    # Connect to all databases
    old_conn = sqlite3.connect(OLD_DB)
    new_conn = sqlite3.connect(NEW_DB)
    merged_conn = sqlite3.connect(MERGED_DB)
    
    try:
        print("Setting up merged schema...")
        setup_merged_schema(merged_conn.cursor())
        
        print("Migrating data...")
        migrate_data(old_conn.cursor(), new_conn.cursor(), merged_conn.cursor())
        
        # Commit changes
        merged_conn.commit()
        print("Migration completed successfully!")
        
        # Verify migration
        cur = merged_conn.cursor()
        cur.execute("SELECT COUNT(*) FROM media_assets")
        count = cur.fetchone()[0]
        print(f"Total assets in merged database: {count}")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        merged_conn.rollback()
        raise
    finally:
        old_conn.close()
        new_conn.close()
        merged_conn.close()

if __name__ == '__main__':
    main() 