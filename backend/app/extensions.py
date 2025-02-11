"""
Shared Flask extensions and instances.
This module helps avoid circular imports by providing a central place for shared instances.
"""
from flask_socketio import SocketIO

# Initialize Socket.IO without app
# It will be initialized with the app later
socketio = SocketIO() 