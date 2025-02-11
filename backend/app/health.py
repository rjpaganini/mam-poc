# health.py - Basic health monitoring
from flask import Blueprint, jsonify, current_app
from datetime import datetime
import logging
from typing import Dict, Any
from sqlalchemy import text
from .extensions import socketio
from .database import db

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
    """Get WebSocket health status"""
    try:
        # Access Socket.IO server safely through the managed instance
        server = socketio.server if hasattr(socketio, 'server') else None
        if server and hasattr(server, 'manager'):
            rooms = len(server.manager.rooms)
            return {
                'status': 'healthy',
                'connections': rooms,
                'protocols': ['socket.io']
            }
        
        return {
            'status': 'initializing',
            'connections': 0,
            'protocols': ['socket.io']
        }
    except Exception as e:
        logger.warning(f"Error getting WebSocket health: {e}")
        return {
            'status': 'error',
            'message': str(e),
            'connections': 0,
            'protocols': ['socket.io']
        }

@health.route('/health/status')
def health_status():
    """Health check endpoint focused on critical components"""
    try:
        db_health = get_database_health()
        ws_health = get_websocket_health()
        
        # Overall status is healthy only if both components are healthy
        status = 'healthy' if (db_health['status'] == 'healthy' and 
                             ws_health['status'] == 'healthy') else 'error'
        
        return jsonify({
            'status': status,
            'timestamp': datetime.utcnow().isoformat(),
            'database': db_health,
            'websocket': ws_health
        }), 200 if status == 'healthy' else 503
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 500

def init_health(app):
    """Initialize health monitoring"""
    app.register_blueprint(health, url_prefix='/api/v1')
    logger.info("Health monitoring initialized") 