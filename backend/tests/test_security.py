"""
Basic tests for local development.
Simplified for POC phase.
"""

import pytest
from pathlib import Path
from app import create_app
from app.utils.backup import backup_database, restore_database
from app.config import BASE_DIR

@pytest.fixture
def app():
    """Create test application."""
    app = create_app()
    app.config['TESTING'] = True
    return app

@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()

def test_basic_access(client):
    """Test basic API access."""
    response = client.get('/api/v1/status')
    assert response.status_code == 200

def test_database_backup(tmp_path):
    """Test basic backup functionality."""
    # Create test database
    db_file = Path(BASE_DIR) / 'instance' / 'app.db'
    db_file.parent.mkdir(exist_ok=True)
    db_file.touch()
    
    # Perform backup
    backup_file = backup_database()
    assert backup_file.exists()
    
    # Test restore
    db_file.unlink()
    assert not db_file.exists()
    restore_database(backup_file)
    assert db_file.exists() 