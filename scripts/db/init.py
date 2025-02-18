#!/usr/bin/env python3
"""
Database Initialization Script for MAM application
Author: Senior Developer
Version: 2.0.0
Last Updated: 2024-02-13

This script validates the existing merged.db database.
It does NOT recreate the database, only verifies its existence and structure.
"""

import os
import sys
import sqlite3
import logging
from pathlib import Path

# Add backend directory to Python path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.append(str(PROJECT_ROOT))

# Configure paths
DATA_DIR = PROJECT_ROOT / 'data'
DB_PATH = DATA_DIR / 'merged.db'

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(PROJECT_ROOT / 'logs' / 'db_init.log')
    ]
)
logger = logging.getLogger(__name__)

def verify_database_exists():
    """Verify that merged.db exists in the data directory"""
    if not DATA_DIR.exists():
        logger.error(f"Data directory not found: {DATA_DIR}")
        return False
        
    if not DB_PATH.exists():
        logger.error(f"Database file not found: {DB_PATH}")
        return False
        
    return True

def verify_database_structure():
    """Verify database structure and integrity"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        
        # Check database integrity
        logger.info("Checking database integrity...")
        cur.execute("PRAGMA integrity_check;")
        integrity_result = cur.fetchone()[0]
        if integrity_result != "ok":
            logger.error(f"Database integrity check failed: {integrity_result}")
            return False
            
        # Verify essential tables exist
        logger.info("Verifying database structure...")
        cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = {row[0] for row in cur.fetchall()}
        
        required_tables = {'media_assets', 'media_directories'}
        missing_tables = required_tables - tables
        
        if missing_tables:
            logger.error(f"Missing required tables: {missing_tables}")
            return False
            
        # Verify media_assets table structure
        cur.execute("PRAGMA table_info(media_assets);")
        columns = {row[1] for row in cur.fetchall()}
        
        required_columns = {
            'id', 'title', 'file_path', 'file_size', 'format',
            'duration', 'duration_formatted', 'created_at', 'updated_at'
        }
        missing_columns = required_columns - columns
        
        if missing_columns:
            logger.error(f"Missing required columns in media_assets: {missing_columns}")
            return False
            
        logger.info("Database structure verification completed successfully")
        return True
        
    except sqlite3.Error as e:
        logger.error(f"Database verification failed: {e}")
        return False
        
    finally:
        if 'conn' in locals():
            conn.close()

def main():
    """Main entry point"""
    logger.info("Starting database initialization check...")
    
    # Verify database exists
    if not verify_database_exists():
        sys.exit(1)
    
    # Verify database structure
    if not verify_database_structure():
        sys.exit(1)
    
    logger.info("Database initialization check completed successfully")
    sys.exit(0)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Database initialization interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error during database initialization: {e}")
        sys.exit(1) 