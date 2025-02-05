# health.py - System Health Monitoring
# Purpose: Provides health check endpoints for database and WebSocket status

from flask import Blueprint, jsonify, current_app
from datetime import datetime
from sqlalchemy import text
import logging
from typing import Dict, Any
from .config import API_PREFIX
from .websocket import get_connection_stats

# Configure module-level logger
logger = logging.getLogger(__name__)

# Create blueprint with versioned prefix
health = Blueprint('health', __name__, url_prefix=f'{API_PREFIX}')

class HealthStatus:
    """Health status constants."""
    HEALTHY = 'healthy'
    DEGRADED = 'degraded'
    ERROR = 'error'

def check_database() -> Dict[str, Any]:
    """Check database connectivity."""
    try:
        current_app.db.session.execute(text('SELECT 1'))
        return {
            'status': HealthStatus.HEALTHY,
            'connected': True
        }
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            'status': HealthStatus.ERROR,
            'connected': False,
            'error': str(e)
        }

def check_websocket() -> Dict[str, Any]:
    """Check WebSocket status."""
    try:
        stats = get_connection_stats()
        return {
            'status': HealthStatus.HEALTHY,
            'connections': stats.get('active_connections', 0),
            'connected': True
        }
    except Exception as e:
        logger.error(f"WebSocket health check failed: {e}")
        return {
            'status': HealthStatus.ERROR,
            'connected': False,
            'error': str(e)
        }

@health.route('/health/status')
def health_status():
    """
    Health check endpoint providing database and WebSocket status.
    Returns:
        JSON with connection statuses
    """
    try:
        # Check database connection
        db_status = True
        try:
            # Use the database instance directly
            from .database import db
            db.session.execute(text('SELECT 1'))
        except Exception as e:
            db_status = False
            logger.error(f"Database health check failed: {e}")
        
        # Check WebSocket status
        ws_status = True
        try:
            stats = get_connection_stats()
        except Exception as e:
            ws_status = False
            logger.error(f"WebSocket check failed: {e}")
        
        status = {
            'status': 'healthy' if db_status and ws_status else 'degraded',
            'timestamp': datetime.utcnow().isoformat(),
            'components': {
                'database': {
                    'status': 'healthy' if db_status else 'error',
                    'connected': db_status
                },
                'websocket': {
                    'status': 'healthy' if ws_status else 'error',
                    'connected': ws_status,
                    'stats': stats if ws_status else None
                }
            }
        }
        
        return jsonify(status), 200 if db_status and ws_status else 503
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 500

def init_health(app):
    """Initialize health monitoring."""
    app.register_blueprint(health)
    logger.info("Health monitoring initialized") 