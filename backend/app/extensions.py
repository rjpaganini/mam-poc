"""
Shared Flask extensions and instances.
This module initializes Flask extensions that are used across the application.
"""

from flask_socketio import SocketIO
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

# Initialize extensions
db = SQLAlchemy()
cors = CORS()

# Initialize Socket.IO with proper configuration
socketio = SocketIO(
    cors_allowed_origins="*",
    async_mode='eventlet',
    logger=True,
    engineio_logger=True,
    ping_timeout=5000,
    ping_interval=25000
) 