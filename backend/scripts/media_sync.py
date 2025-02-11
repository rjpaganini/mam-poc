#!/usr/bin/env python3
"""
Media Synchronization Script
Handles synchronization between local media directory and Google Drive backup.
"""

import os
import shutil
import logging
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('media_sync')

def load_config():
    """Load configuration from environment variables."""
    load_dotenv()
    return {
        'local_path': os.getenv('MEDIA_BASE_PATH'),
        'backup_path': os.getenv('MEDIA_BACKUP_PATH'),
        'sync_enabled': os.getenv('MEDIA_SYNC_ENABLED', 'true').lower() == 'true'
    }

def ensure_directories(local_path, backup_path):
    """Ensure required directories exist."""
    Path(local_path).mkdir(parents=True, exist_ok=True)
    if not os.path.exists(backup_path):
        logger.error(f"Backup path not accessible: {backup_path}")
        return False
    return True

def sync_media(local_path, backup_path):
    """Synchronize media files between local and backup paths."""
    try:
        # Create local subdirectories if they don't exist
        for subdir in ['videos', 'images', 'temp']:
            Path(os.path.join(local_path, subdir)).mkdir(parents=True, exist_ok=True)
        
        # Sync from backup to local
        for root, _, files in os.walk(backup_path):
            for file in files:
                if file.startswith('.'):  # Skip hidden files
                    continue
                    
                src_file = os.path.join(root, file)
                rel_path = os.path.relpath(src_file, backup_path)
                dst_file = os.path.join(local_path, rel_path)
                
                # Only copy if file doesn't exist or is newer
                if not os.path.exists(dst_file) or \
                   os.path.getmtime(src_file) > os.path.getmtime(dst_file):
                    os.makedirs(os.path.dirname(dst_file), exist_ok=True)
                    shutil.copy2(src_file, dst_file)
                    logger.info(f"Synced: {rel_path}")
        
        return True
    except Exception as e:
        logger.error(f"Sync failed: {str(e)}")
        return False

def main():
    """Main execution function."""
    config = load_config()
    if not config['sync_enabled']:
        logger.info("Media sync is disabled")
        return
    
    if not ensure_directories(config['local_path'], config['backup_path']):
        return
    
    logger.info("Starting media synchronization...")
    start_time = datetime.now()
    
    success = sync_media(config['local_path'], config['backup_path'])
    
    duration = datetime.now() - start_time
    logger.info(f"Sync completed in {duration.total_seconds():.2f}s (Success: {success})")

if __name__ == '__main__':
    main() 