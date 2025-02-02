# backend/app/utils/backup.py
# Database backup utilities with compression and rotation

import os
import shutil
import gzip
from datetime import datetime
from pathlib import Path
from ..config import BASE_DIR

def backup_database(max_backups=5):
    """
    Create a compressed backup of the SQLite database.
    Maintains a rotating set of backups.
    """
    # Setup backup directory
    backup_dir = Path(BASE_DIR) / 'backups'
    backup_dir.mkdir(exist_ok=True)
    
    # Source database file
    db_file = Path(BASE_DIR) / 'instance' / 'app.db'
    if not db_file.exists():
        raise FileNotFoundError("Database file not found")
    
    # Create backup filename with timestamp
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_file = backup_dir / f'app_db_{timestamp}.gz'
    
    # Compress and copy database
    with open(db_file, 'rb') as f_in:
        with gzip.open(backup_file, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)
    
    # Rotate old backups
    backups = sorted(backup_dir.glob('app_db_*.gz'))
    while len(backups) > max_backups:
        backups[0].unlink()  # Remove oldest backup
        backups = backups[1:]
    
    return backup_file

def restore_database(backup_file):
    """
    Restore database from a backup file.
    """
    db_file = Path(BASE_DIR) / 'instance' / 'app.db'
    
    # Create temporary file for decompression
    temp_file = db_file.with_suffix('.tmp')
    
    try:
        # Decompress backup
        with gzip.open(backup_file, 'rb') as f_in:
            with open(temp_file, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
        
        # Replace current database
        shutil.move(temp_file, db_file)
        return True
        
    except Exception as e:
        if temp_file.exists():
            temp_file.unlink()
        raise e

def schedule_backup():
    """
    Schedule regular database backups.
    Called by the scheduler in app/__init__.py
    """
    try:
        backup_file = backup_database()
        return f"Backup created: {backup_file}"
    except Exception as e:
        return f"Backup failed: {str(e)}" 