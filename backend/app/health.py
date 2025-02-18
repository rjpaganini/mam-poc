# health.py - Basic health monitoring
from flask import Blueprint, jsonify, current_app
from datetime import datetime
import logging
from typing import Dict, Any, cast
from sqlalchemy import text
from .extensions import socketio
from .database import db
from .types import FlaskApp
from flask_socketio import SocketIO

logger = logging.getLogger(__name__)
health = Blueprint('health', __name__)

def get_database_health() -> Dict[str, Any]:
    """Get database connectivity status"""
    try:
        with current_app.app_context():
            # Use SQLAlchemy text() for raw SQL
            result = db.session.execute(text('SELECT 1')).scalar()
            if result != 1:
                raise ValueError("Database check failed: unexpected result")
            
            # Check if we can access the merged database
            db_path = current_app.config.get('SQLALCHEMY_DATABASE_URI', '')
            return {
                'status': 'healthy',
                'message': 'Connected to database',
                'path': db_path
            }
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            'status': 'error',
            'message': str(e)
        }

def get_websocket_health() -> Dict[str, Any]:
    """Get WebSocket health status with safe initialization checks"""
    try:
        # First, check if we have socketio
        if not socketio:
            return {
                'status': 'initializing',
                'message': 'WebSocket server is initializing',
                'connections': 0
            }
        
        # Safely get server stats
        stats = {
            'ping_interval': getattr(socketio, 'ping_interval', None),
            'ping_timeout': getattr(socketio, 'ping_timeout', None),
            'async_mode': getattr(socketio, 'async_mode', None)
        }
        
        # Safely check server and manager
        server = getattr(socketio, 'server', None)
        if not server:
            return {
                'status': 'initializing',
                'message': 'Server not fully initialized',
                'stats': stats,
                'connections': 0
            }

        return {
            'status': 'healthy',
            'connections': len(getattr(server, 'manager', {}).get('rooms', {})),
            'stats': stats
        }
    except Exception as e:
        logger.error(f"WebSocket health check failed: {e}")
        return {
            'status': 'error',
            'message': str(e),
            'connections': 0
        }

def get_processing_health() -> Dict[str, Any]:
    """Get media processing status"""
    try:
        # Get processing manager from current app
        if not current_app:
            return {
                'status': 'unknown',
                'message': 'No application context'
            }
            
        app = cast(FlaskApp, current_app)
        if not hasattr(app, 'processing_manager') or app.processing_manager is None:
            return {
                'status': 'unknown',
                'message': 'Processing manager not initialized'
            }
        
        # Get queue status from processing manager
        queue_status = app.processing_manager.get_queue_status()
        
        return {
            'status': queue_status.get('status', 'unknown'),
            'active_tasks': queue_status.get('active_tasks', 0),
            'max_concurrent': queue_status.get('max_concurrent', 0),
            'last_update': queue_status.get('last_update')
        }
    except Exception as e:
        logger.error(f"Processing health check failed: {e}")
        return {
            'status': 'error',
            'message': str(e)
        }

@health.route('/health/status', methods=['GET'])
def health_status():
    """Get comprehensive health status"""
    try:
        # Get all component health statuses
        with current_app.app_context():
            db_health = get_database_health()
            ws_health = get_websocket_health()
            proc_health = get_processing_health()
            
            # Determine overall status
            status = 'healthy'
            if db_health['status'] != 'healthy' or ws_health['status'] != 'healthy':
                status = 'error'
            elif proc_health['status'] in ['error', 'unknown']:
                status = 'warning'
            
            return jsonify({
                'status': status,
                'timestamp': datetime.utcnow().isoformat(),
                'database': db_health,
                'websocket': ws_health,
                'processing': proc_health
            }), 200
            
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 500

def init_health(app):
    """Initialize health monitoring"""
    app.register_blueprint(health)
    logger.info("Health monitoring initialized") 