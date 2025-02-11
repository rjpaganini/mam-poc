"""
Simple status service for real-time processing updates.
"""
import logging
from .main import get_socketio

logger = logging.getLogger(__name__)
socketio = get_socketio()

def emit_processing_update(asset_name: str, progress: int, stage: str):
    """
    Emit a processing status update.
    
    Args:
        asset_name: Name of the asset being processed
        progress: Processing progress (0-100)
        stage: Current processing stage
    """
    try:
        update = {
            'type': 'processing_update',
            'asset_name': asset_name,
            'progress': progress,
            'stage': stage
        }
        socketio.emit('status_update', update)
        logger.debug(f"Emitted status update: {update}")
    except Exception as e:
        logger.error(f"Failed to emit status update: {e}")

def emit_error(message: str):
    """
    Emit an error message.
    
    Args:
        message: Error message to send
    """
    try:
        socketio.emit('status_error', {'message': message})
        logger.error(f"Emitted error: {message}")
    except Exception as e:
        logger.error(f"Failed to emit error: {e}") 