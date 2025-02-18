"""
Logger configuration for the application.
"""

import logging
import sys
from pathlib import Path
from logging.handlers import RotatingFileHandler

def setup_logging(app=None):
    """Configure logging for the application."""
    # Create logs directory if it doesn't exist
    log_dir = Path('logs')
    log_dir.mkdir(exist_ok=True)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    # Create formatters
    console_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    file_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)
    
    # File handler for backend.log
    backend_handler = RotatingFileHandler(
        'logs/backend.log',
        maxBytes=10485760,  # 10MB
        backupCount=5
    )
    backend_handler.setFormatter(file_formatter)
    root_logger.addHandler(backend_handler)
    
    # Set Flask logger level
    if app:
        app.logger.setLevel(logging.INFO)
    
    return root_logger

# Create logger instance
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Export logger methods
debug = logger.debug
info = logger.info
warning = logger.warning
error = logger.error
critical = logger.critical 