"""
WSGI entry point for the Flask application.
Uses gevent-websocket for WebSocket support.
"""

# Apply gevent monkey patch before any other imports
from gevent import monkey; monkey.patch_all()  # type: ignore

# WebSocket and server imports
from gevent.pywsgi import WSGIServer  # type: ignore
from geventwebsocket.handler import WebSocketHandler  # type: ignore
from app import create_app
from flask_cors import CORS

# Create Flask application instance
app = create_app()

# Simple CORS configuration - allow everything from our frontend
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3001"],
        "supports_credentials": True,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

if __name__ == '__main__':
    # Get port from environment or use default
    port = int(app.config.get('PORT', 5001))
    
    print(f"\nStarting server on port {port}...")
    print(f"WebSocket endpoint: ws://localhost:{port}/ws")
    
    # Create and configure WSGI server with WebSocket support
    http_server = WSGIServer(
        ('0.0.0.0', port),
        app,
        handler_class=WebSocketHandler
    )
    
    # Start server
    http_server.serve_forever() 