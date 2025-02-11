"""Enhanced logging configuration with structured output and request tracking."""
import logging
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
import os
from pathlib import Path
from flask import request, has_request_context, g
import uuid
import json

class RequestFormatter(logging.Formatter):
    """Custom formatter that adds request context."""
    
    def format(self, record):
        """Add request_id and endpoint to log records."""
        if has_request_context():
            record.request_id = getattr(g, 'request_id', str(uuid.uuid4())[:8])
            record.endpoint = request.endpoint
            record.ip = request.remote_addr
        else:
            record.request_id = 'no_req'
            record.endpoint = 'no_endpoint'
            record.ip = 'no_ip'
            
        # Add timestamp in ISO format
        record.timestamp = self.formatTime(record, '%Y-%m-%dT%H:%M:%S.%fZ')
        
        # Add component info
        if not hasattr(record, 'component'):
            record.component = record.name.split('.')[0]
            
        return super().format(record)

def setup_logger(app):
    """Configure application logging with comprehensive tracking."""
    # Create logs directory
    log_dir = Path(app.root_path).parent.parent / 'logs'
    log_dir.mkdir(exist_ok=True)
    
    # Enhanced log format with full context
    log_format = (
        '%(timestamp)s [%(levelname)s] '
        'req=%(request_id)s '
        'ep=%(endpoint)s '
        'ip=%(ip)s '
        'component=%(component)s '
        '%(module)s:%(funcName)s:%(lineno)d - '
        '%(message)s'
    )
    
    formatter = RequestFormatter(log_format)
    
    # 1. Main Application Log (app.log)
    # Rotates daily, keeps 30 days of history
    app_handler = TimedRotatingFileHandler(
        log_dir / 'app.log',
        when='midnight',
        interval=1,
        backupCount=30,
        encoding='utf-8'
    )
    app_handler.setFormatter(formatter)
    app_handler.setLevel(logging.INFO)
    
    # 2. Error Log (error.log)
    # Rotates at 50MB, keeps last 10 files
    error_handler = RotatingFileHandler(
        log_dir / 'error.log',
        maxBytes=50 * 1024 * 1024,
        backupCount=10,
        encoding='utf-8'
    )
    error_handler.setFormatter(formatter)
    error_handler.setLevel(logging.ERROR)
    
    # 3. System Log (system.log)
    # Contains health checks, websockets, services
    system_handler = TimedRotatingFileHandler(
        log_dir / 'system.log',
        when='midnight',
        interval=1,
        backupCount=7,
        encoding='utf-8'
    )
    system_handler.setFormatter(formatter)
    system_handler.setLevel(logging.INFO)
    
    # Configure flask logger
    app.logger.handlers = []  # Remove default handlers
    app.logger.addHandler(app_handler)
    app.logger.addHandler(error_handler)
    app.logger.addHandler(system_handler)
    app.logger.setLevel(logging.DEBUG if app.debug else logging.INFO)
    
    # Configure component loggers
    components = ['websocket', 'health', 'media', 'processing']
    for component in components:
        logger = logging.getLogger(component)
        logger.handlers = []  # Clear any existing handlers
        logger.addHandler(app_handler)
        logger.addHandler(error_handler)
        logger.addHandler(system_handler)
        logger.setLevel(logging.DEBUG if app.debug else logging.INFO)
    
    # Quiet down werkzeug in production
    if not app.debug:
        logging.getLogger('werkzeug').setLevel(logging.ERROR)
    
    # Add request ID middleware
    @app.before_request
    def add_request_id():
        g.request_id = str(uuid.uuid4())[:8]
        # Log incoming requests
        app.logger.info(
            'Request received',
            extra={
                'method': request.method,
                'path': request.path,
                'ip': request.remote_addr,
                'user_agent': request.headers.get('User-Agent')
            }
        )
    
    # Add response logging
    @app.after_request
    def log_response(response):
        app.logger.info(
            'Request completed',
            extra={
                'status': response.status_code,
                'size': len(response.get_data()),
                'time_ms': request.environ.get('request_time_ms')
            }
        )
        return response
    
    app.logger.info('Logger initialized', extra={'custom': 'startup'})
    return app.logger

def get_logger(name=None):
    """Get a logger instance with the proper configuration."""
    return logging.getLogger(name or 'flask.app') 