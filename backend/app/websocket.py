"""
Simple WebSocket handler for real-time media asset updates.
Implements a clean, protocol-aware WebSocket server with proper connection lifecycle.
"""
from gevent import monkey
monkey.patch_all()

import logging
import json
from typing import Dict, Any, Set, Optional
from datetime import datetime
from geventwebsocket.handler import WebSocketHandler
from geventwebsocket.websocket import WebSocket
from geventwebsocket.exceptions import WebSocketError

logger = logging.getLogger(__name__)

# Define supported WebSocket protocols - used during handshake
SUPPORTED_PROTOCOLS = ['mam-protocol']

# Type-safe active connections set with protocol tracking
class ProtocolWebSocket:
    """Wrapper to track WebSocket protocol safely"""
    def __init__(self, ws: WebSocket, protocol: Optional[str]):
        self.ws = ws
        self._protocol = protocol
        
    @property
    def protocol(self) -> Optional[str]:
        """Safe protocol access"""
        return self._protocol
        
    def __getattr__(self, name):
        """Delegate all other attributes to wrapped WebSocket"""
        return getattr(self.ws, name)

# Track active connections with protocols
active_connections: Set[ProtocolWebSocket] = set()

class WebSocketApp:
    """
    WebSocket application handler with proper protocol negotiation and lifecycle management.
    Handles WebSocket connections with proper protocol support and error handling.
    """
    def __init__(self, app):
        self.flask_app = app
        self.original_wsgi_app = app.wsgi_app
        
    def get_protocol(self, environ) -> Optional[str]:
        """
        Get negotiated protocol from environment.
        
        Args:
            environ: WSGI environment dictionary
            
        Returns:
            Optional[str]: Negotiated protocol or None
        """
        # Check Sec-WebSocket-Protocol header
        if 'HTTP_SEC_WEBSOCKET_PROTOCOL' in environ:
            requested = environ['HTTP_SEC_WEBSOCKET_PROTOCOL'].split(',')
            # Return first supported protocol
            for protocol in requested:
                if protocol.strip() in SUPPORTED_PROTOCOLS:
                    return protocol.strip()
        return None
        
    def validate_protocol(self, environ) -> Optional[str]:
        """
        Validate WebSocket protocol during connection phase.
        
        Args:
            environ: WSGI environment dictionary
            
        Returns:
            Optional[str]: Valid protocol or None if validation fails
        """
        protocol = self.get_protocol(environ)
        if not protocol:
            logger.error("No supported protocol found")
            return None
            
        # Store protocol in environment for gevent-websocket
        environ['wsgi.websocket_version'] = 13  # WebSocket protocol version
        environ['wsgi.websocket_protocol'] = protocol
        return protocol
        
    def handle_message(self, wrapped_ws: ProtocolWebSocket, message: str) -> None:
        """
        Handle incoming WebSocket messages with proper error handling.
        
        Args:
            wrapped_ws: ProtocolWebSocket instance
            message: Raw message string to process
        """
        if not message:
            logger.debug("Empty message received, ignoring")
            return
            
        try:
            data = json.loads(message)
            msg_type = data.get('type')
            
            # Prepare base response with proper typing
            response: Dict[str, Any] = {
                'timestamp': datetime.utcnow().isoformat()
            }
            
            if msg_type == 'handshake':
                # Enhanced handshake response with connection info
                response.update({
                    'type': 'handshake_response',
                    'status': 'success',
                    'server_info': {
                        'connections': len(active_connections),
                        'protocol': wrapped_ws.protocol,
                        'version': '1.0.0'
                    }
                })
                logger.info(f"Handshake successful. Protocol: {wrapped_ws.protocol}")
            
            elif msg_type == 'ping':
                # Simple ping-pong for connection health
                response.update({
                    'type': 'pong',
                    'server_time': datetime.utcnow().isoformat()
                })
                logger.debug("Ping received, sending pong")
            
            else:
                # Echo other messages with server timestamp
                response.update(data)
                logger.debug(f"Echoing message: {response}")
            
            # Send response with proper error handling
            if not wrapped_ws.closed:
                wrapped_ws.send(json.dumps(response))
            
        except json.JSONDecodeError as e:
            logger.warning(f"Invalid JSON received: {message}. Error: {e}")
        except WebSocketError as e:
            logger.error(f"WebSocket error during message handling: {e}")
            self.handle_disconnect(wrapped_ws)
        except Exception as e:
            logger.error(f"Message handling error: {e}", exc_info=True)
            
    def handle_disconnect(self, wrapped_ws: ProtocolWebSocket) -> None:
        """
        Handle WebSocket disconnection cleanly.
        
        Args:
            wrapped_ws: ProtocolWebSocket connection to clean up
        """
        try:
            if wrapped_ws in active_connections:
                active_connections.remove(wrapped_ws)
                logger.info(f"Client disconnected. Remaining connections: {len(active_connections)}")
        except Exception as e:
            logger.error(f"Error during disconnect handling: {e}", exc_info=True)
            
    def __call__(self, environ, start_response):
        """
        WSGI entry point with proper WebSocket protocol handling.
        Handles both WebSocket upgrades and normal HTTP requests.
        """
        # Check if this is a WebSocket request
        if environ.get('PATH_INFO') == '/api/v1/ws':
            # Validate protocol before getting WebSocket
            protocol = self.validate_protocol(environ)
            if protocol is None:
                start_response('400 Bad Request', [('Content-Type', 'text/plain')])
                return [b'Protocol not supported']
                
            # Now get WebSocket with protocol already set in environ
            ws = environ.get('wsgi.websocket')
            if not ws:
                start_response('400 Bad Request', [('Content-Type', 'text/plain')])
                return [b'WebSocket connection required']
                
            # Wrap WebSocket with protocol tracking
            wrapped_ws = ProtocolWebSocket(ws, protocol)
                
            # Use Flask app context for proper database access
            with self.flask_app.app_context():
                active_connections.add(wrapped_ws)
                logger.info(f"Client connected. Protocol: {protocol}, Total connections: {len(active_connections)}")
                
                try:
                    # Send welcome message
                    welcome = {
                        'type': 'welcome',
                        'timestamp': datetime.utcnow().isoformat(),
                        'protocol': protocol
                    }
                    wrapped_ws.send(json.dumps(welcome))
                    
                    # Main message loop with improved error handling
                    while not wrapped_ws.closed:
                        try:
                            message = wrapped_ws.receive()
                            if message is None:  # Clean disconnect
                                break
                            self.handle_message(wrapped_ws, message)
                        except WebSocketError as e:
                            logger.error(f"WebSocket error in message loop: {e}")
                            break
                        
                except Exception as e:
                    logger.error(f"WebSocket error: {e}", exc_info=True)
                finally:
                    self.handle_disconnect(wrapped_ws)
                return []
                
        # Not a WebSocket request, handle normally
        return self.original_wsgi_app(environ, start_response)

def init_websocket(app):
    """Initialize WebSocket support with protocol awareness"""
    app.wsgi_app = WebSocketApp(app)
    logger.info(f"WebSocket handler initialized with protocols: {SUPPORTED_PROTOCOLS}")

def broadcast(message: Dict[str, Any]) -> None:
    """
    Broadcast message to all connected clients with proper error handling.
    
    Args:
        message: Dictionary to be JSON-encoded and broadcast
    """
    if not active_connections:
        logger.debug("No active connections for broadcast")
        return
        
    disconnected = set()
    try:
        encoded_message = json.dumps(message)
    except (TypeError, ValueError) as e:
        logger.error(f"Failed to encode broadcast message: {e}")
        return
    
    for wrapped_ws in active_connections:
        try:
            if not wrapped_ws.closed:
                wrapped_ws.send(encoded_message)
            else:
                disconnected.add(wrapped_ws)
        except WebSocketError as e:
            logger.error(f"WebSocket error during broadcast: {e}")
            disconnected.add(wrapped_ws)
        except Exception as e:
            logger.error(f"Broadcast error: {e}")
            disconnected.add(wrapped_ws)
            
    # Clean up disconnected clients
    for wrapped_ws in disconnected:
        if wrapped_ws in active_connections:
            active_connections.remove(wrapped_ws)
            logger.info(f"Removed disconnected client. Remaining: {len(active_connections)}")