# backend/app/database.py
# Database configuration and session management

from flask_sqlalchemy import SQLAlchemy
from flask import Flask
import logging
from pathlib import Path
import os

# Configure module-level logger
logger = logging.getLogger(__name__)

# Create database instance
db = SQLAlchemy()

def init_db(app: Flask) -> None:
    """
    Initialize database with application context.
    
    Args:
        app: Flask application instance with configuration
        
    Raises:
        Exception: If database initialization fails
    """
    try:
        # Ensure data directory exists
        data_dir = Path(app.config['DATA_DIR'])
        data_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize SQLAlchemy with app context
        db.init_app(app)
        
        # Create all tables
        with app.app_context():
            db.create_all()
            logger.info(f"Database initialized at {app.config['SQLALCHEMY_DATABASE_URI']}")
            
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}")
        raise