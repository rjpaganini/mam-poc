"""Enhanced logging configuration with structured output and request tracking."""
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
from flask import request, has_request_context
import uuid

class RequestFormatter(logging.Formatter):
    """Custom formatter that adds request context."""
    
    def format(self, record):
        """Add request_id and endpoint to log records."""
        if has_request_context():
            record.request_id = getattr(request, 'id', str(uuid.uuid4())[:8])
            record.endpoint = request.endpoint
        else:
            record.request_id = 'no_req'
            record.endpoint = 'no_endpoint'
        return super().format(record)

def setup_logger(app):
    """
    Configure application logging with:
    - Structured output
    - Request tracking
    - Automatic rotation
    - Different levels for dev/prod
    """
    # Create logs directory if needed
    log_dir = Path(app.root_path).parent.parent / 'logs'
    log_dir.mkdir(exist_ok=True)
    
    # Enhanced log format with request context
    log_format = (
        '%(asctime)s [%(levelname)s] '
        'req=%(request_id)s '
        'ep=%(endpoint)s '
        '%(module)s:%(funcName)s:%(lineno)d - '
        '%(message)s'
    )
    
    formatter = RequestFormatter(log_format)
    
    # Rotating file handler (10MB files, keep 5)
    file_handler = RotatingFileHandler(
        log_dir / 'app.log',
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)
    
    # Console handler for development
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.DEBUG if app.debug else logging.INFO)
    
    # Configure flask logger
    app.logger.handlers = []  # Remove default handlers
    app.logger.addHandler(file_handler)
    app.logger.addHandler(console_handler)
    app.logger.setLevel(logging.DEBUG if app.debug else logging.INFO)
    
    # Quiet down werkzeug in production
    if not app.debug:
        logging.getLogger('werkzeug').setLevel(logging.ERROR)
    
    # Add request ID middleware
    @app.before_request
    def add_request_id():
        request.id = str(uuid.uuid4())[:8]
    
    app.logger.info('Logger initialized', extra={'custom': 'startup'})
    return app.logger

def get_logger():
    """Get the application logger."""
    return logging.getLogger('flask.app') 