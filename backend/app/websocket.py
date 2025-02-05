"""
WebSocket management for real-time communication.
"""

from flask_sock import Sock
import logging
from datetime import datetime
import json
from typing import Dict, Any
import uuid

# Configure logging
logger = logging.getLogger(__name__)

# Initialize WebSocket
sock = Sock()

# Active connections pool
class ConnectionPool:
    def __init__(self):
        self.connections = {}
        
    def add(self, connection_id: str, ws) -> None:
        """Add a connection to the pool."""
        self.connections[connection_id] = {
            'ws': ws,
            'connected_at': datetime.utcnow().isoformat(),
            'last_ping': datetime.utcnow().isoformat()
        }
        logger.info(f"Added connection {connection_id} to pool")
        
    def remove(self, connection_id: str) -> None:
        """Remove a connection from the pool."""
        if connection_id in self.connections:
            del self.connections[connection_id]
            logger.info(f"Removed connection {connection_id} from pool")
            
    def update_ping(self, connection_id: str) -> None:
        """Update last ping time for a connection."""
        if connection_id in self.connections:
            self.connections[connection_id]['last_ping'] = datetime.utcnow().isoformat()
            
    def get_stats(self) -> Dict[str, Any]:
        """Get connection pool statistics."""
        return {
            'active_connections': len(self.connections),
            'connections': [{
                'id': conn_id,
                'connected_at': data['connected_at'],
                'last_ping': data['last_ping']
            } for conn_id, data in self.connections.items()]
        }

# Create connection pool instance
connection_pool = ConnectionPool()

def get_connection_stats() -> Dict[str, Any]:
    """Get current WebSocket connection statistics."""
    return connection_pool.get_stats()

def broadcast_message(message: Dict[str, Any]) -> None:
    """Broadcast a message to all connected clients."""
    message_json = json.dumps(message)
    for conn_id, conn_data in connection_pool.connections.items():
        try:
            conn_data['ws'].send(message_json)
        except Exception as e:
            logger.error(f"Failed to send message to {conn_id}: {e}")
            connection_pool.remove(conn_id)

def init_websocket(app):
    """Initialize WebSocket with the Flask application."""
    sock.init_app(app)
    
    @sock.route('/ws')
    def handle_websocket(ws):
        """WebSocket connection handler."""
        connection_id = str(uuid.uuid4())[:8]
        try:
            logger.info(f"New WebSocket connection established [id={connection_id}]")
            connection_pool.add(connection_id, ws)
            
            # Send initial connection status
            ws.send(json.dumps({
                'type': 'connection_status',
                'data': {
                    'status': 'connected',
                    'connectionId': connection_id,
                    'serverTime': datetime.utcnow().isoformat()
                }
            }))
            
            while True:
                try:
                    data = ws.receive()
                    if data is None:
                        break
                        
                    if data == 'ping':
                        connection_pool.update_ping(connection_id)
                        ws.send(json.dumps({
                            'type': 'pong',
                            'data': {
                                'status': 'alive',
                                'connectionId': connection_id,
                                'serverTime': datetime.utcnow().isoformat()
                            }
                        }))
                        
                except Exception as e:
                    logger.error(f"Error handling message: {e}")
                    break
                    
        except Exception as e:
            logger.error(f"WebSocket error [id={connection_id}]: {e}")
        finally:
            connection_pool.remove(connection_id)
            logger.info(f"WebSocket connection terminated [id={connection_id}]") 