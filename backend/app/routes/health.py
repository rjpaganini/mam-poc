"""
Simple health check endpoint
"""

from flask import Blueprint, jsonify
from sqlalchemy import text
from ..database import db
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

def register_health_routes(bp: Blueprint) -> None:
    @bp.route('/health/status', methods=['GET'])
    def health_status():
        """Basic health check that doesn't require WebSocket"""
        try:
            # Simple database check
            with db.engine.connect() as conn:
                conn.execute(text('SELECT 1'))
                
            return jsonify({
                'status': 'healthy',
                'timestamp': datetime.utcnow().isoformat(),
                'database': {
                    'status': 'healthy',
                    'message': 'Connected to database'
                }
            }), 200
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return jsonify({
                "status": "error",
                "message": str(e)
            }), 503 