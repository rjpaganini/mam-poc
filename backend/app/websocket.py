"""
WebSocket handler for real-time communication.
"""

from flask_sock import Sock
from flask import Flask, current_app
from datetime import datetime
import json
import logging
from typing import Dict, Any, Optional
from .config import Config

# Configure module-level logger
logger = logging.getLogger(__name__)

# Initialize WebSocket handler
sock = Sock()

class WebSocketError(Exception):
    """Custom exception for WebSocket-related errors."""
    pass

def create_message(msg_type: str, data: Dict[str, Any]) -> str:
    """
    Create a formatted WebSocket message.
    
    Args:
        msg_type: Type of message (status, error, progress, etc.)
        data: Message payload
        
    Returns:
        str: JSON-encoded message
    """
    return json.dumps({
        'type': msg_type,
        'data': data,
        'timestamp': datetime.utcnow().isoformat()
    })

def handle_media_scan_progress(ws, progress_data: Dict[str, Any]) -> None:
    """
    Handle media scanning progress updates.
    
    Args:
        ws: WebSocket connection
        progress_data: Scan progress information
    """
    try:
        ws.send(create_message('scan_progress', progress_data))
    except Exception as e:
        logger.error(f"Failed to send scan progress: {e}")
        raise WebSocketError(f"Failed to send scan progress: {e}")

def handle_thumbnail_progress(ws, thumbnail_data: Dict[str, Any]) -> None:
    """
    Handle thumbnail generation progress updates.
    
    Args:
        ws: WebSocket connection
        thumbnail_data: Thumbnail generation progress
    """
    try:
        ws.send(create_message('thumbnail_progress', thumbnail_data))
    except Exception as e:
        logger.error(f"Failed to send thumbnail progress: {e}")
        raise WebSocketError(f"Failed to send thumbnail progress: {e}")

def init_websocket(app: Flask) -> None:
    """
    Initialize WebSocket with application context and configuration.
    
    Args:
        app: Flask application instance
    """
    try:
        # Initialize WebSocket with app context
        sock.init_app(app)
        
        @sock.route('/ws')
        def ws(ws):
            """Handle WebSocket connections and messages."""
            try:
                # Send initial connection success
                ws.send(create_message('connection_status', {
                    'status': 'connected',
                    'message': 'WebSocket connected successfully'
                }))
                
                while True:
                    try:
                        # Receive and parse message
                        data = ws.receive()
                        logger.debug(f"Received WebSocket message: {data}")
                        
                        try:
                            message = json.loads(data)
                        except json.JSONDecodeError:
                            ws.send(create_message('error', {
                                'message': 'Invalid message format: expected JSON',
                                'received': data
                            }))
                            continue
                        
                        # Handle message types
                        msg_type = message.get('type')
                        if msg_type == 'ping':
                            ws.send(create_message('pong', {'status': 'alive'}))
                        elif msg_type == 'scan_start':
                            # Handle scan start request
                            media_path = current_app.config['MEDIA_BASE_PATH']
                            ws.send(create_message('scan_start', {
                                'status': 'started',
                                'path': str(media_path)
                            }))
                        elif msg_type == 'thumbnail_request':
                            # Handle thumbnail generation request
                            asset_id = message.get('asset_id')
                            if asset_id:
                                ws.send(create_message('thumbnail_start', {
                                    'status': 'started',
                                    'asset_id': asset_id
                                }))
                        else:
                            ws.send(create_message('error', {
                                'message': f'Unknown message type: {msg_type}',
                                'received': message
                            }))
                            
                    except Exception as e:
                        logger.error(f"Error processing message: {str(e)}", exc_info=True)
                        ws.send(create_message('error', {
                            'message': f'Error processing message: {str(e)}'
                        }))
                        
            except Exception as e:
                logger.error(f"WebSocket connection error: {str(e)}", exc_info=True)
                raise WebSocketError(f"WebSocket connection error: {str(e)}")
                
        logger.info("WebSocket handler initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize WebSocket: {str(e)}")
        raise WebSocketError(f"Failed to initialize WebSocket: {str(e)}") 