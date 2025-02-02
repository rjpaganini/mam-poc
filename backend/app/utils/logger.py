"""Structured logging utility for the Media Asset Manager."""
import logging
import sys
import json
import os
from datetime import datetime
from functools import wraps
from flask import request, has_request_context, current_app
import traceback
from pathlib import Path

class StructuredFormatter(logging.Formatter):
    """Enhanced formatter that outputs JSON structured logs."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.hostname = os.uname().nodename
    
    def format(self, record):
        """Format log record with structured data."""
        # Base log data
        log_data = {
            'timestamp': self.formatTime(record),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'hostname': self.hostname,
            'pid': os.getpid()
        }
        
        # Request context if available
        if has_request_context():
            log_data.update({
                'request_id': request.headers.get('X-Request-ID', 'no-request-id'),
                'url': request.url,
                'method': request.method,
                'ip': request.remote_addr,
                'user_agent': request.headers.get('User-Agent'),
                'path': request.path,
                'endpoint': request.endpoint
            })
        
        # Exception info if present
        if record.exc_info:
            log_data['error'] = {
                'type': record.exc_info[0].__name__,
                'message': str(record.exc_info[1]),
                'stack_trace': ''.join(traceback.format_exception(*record.exc_info))
            }
        
        # Add any extra fields
        if hasattr(record, 'extra_fields'):
            log_data.update(record.extra_fields)
            
        return json.dumps(log_data)

def setup_logger(app):
    """Configure application logging with structured output and proper log paths."""
    # Create logs directory if it doesn't exist
    log_dir = Path(app.root_path).parent / 'logs'
    log_dir.mkdir(exist_ok=True)
    
    # Remove existing handlers
    app.logger.handlers = []
    
    # Configure formatters
    json_formatter = StructuredFormatter()
    console_formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s - %(message)s'
    )
    
    # File handler for JSON structured logs
    json_handler = logging.FileHandler(log_dir / 'app.json.log')
    json_handler.setFormatter(json_formatter)
    json_handler.setLevel(logging.INFO)
    
    # File handler for regular logs
    file_handler = logging.FileHandler(log_dir / 'app.log')
    file_handler.setFormatter(console_formatter)
    file_handler.setLevel(logging.INFO)
    
    # Console handler for development
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(console_formatter)
    console_handler.setLevel(logging.DEBUG if app.debug else logging.INFO)
    
    # Set up app logger
    app.logger.addHandler(json_handler)
    app.logger.addHandler(file_handler)
    app.logger.addHandler(console_handler)
    app.logger.setLevel(logging.DEBUG if app.debug else logging.INFO)
    
    # Log startup information
    app.logger.info("Logger initialized", extra={
        'extra_fields': {
            'app_name': app.name,
            'debug_mode': app.debug,
            'environment': os.getenv('FLASK_ENV', 'production'),
            'config': {
                k: str(v) for k, v in app.config.items() 
                if k not in ['SECRET_KEY'] and not k.startswith('_')
            }
        }
    })
    
    return app.logger

def log_operation(operation_name):
    """Enhanced decorator to log operation details with timing and context."""
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            start_time = datetime.utcnow()
            
            # Log operation start
            current_app.logger.info(f"{operation_name} started", extra={
                'extra_fields': {
                    'operation': operation_name,
                    'args': str(args),
                    'kwargs': {k: v for k, v in kwargs.items() if k != 'password'}
                }
            })
            
            try:
                result = f(*args, **kwargs)
                duration = (datetime.utcnow() - start_time).total_seconds()
                
                # Log successful completion
                current_app.logger.info(
                    f"{operation_name} completed",
                    extra={
                        'extra_fields': {
                            'operation': operation_name,
                            'duration_seconds': duration,
                            'success': True
                        }
                    }
                )
                return result
                
            except Exception as e:
                duration = (datetime.utcnow() - start_time).total_seconds()
                
                # Log failure with details
                current_app.logger.error(
                    f"{operation_name} failed: {str(e)}",
                    exc_info=True,
                    extra={
                        'extra_fields': {
                            'operation': operation_name,
                            'duration_seconds': duration,
                            'success': False,
                            'error_type': e.__class__.__name__
                        }
                    }
                )
                raise
            
        return wrapped
    return decorator 