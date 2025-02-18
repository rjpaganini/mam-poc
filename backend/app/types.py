"""
Custom type definitions for the application.
"""

from flask import Flask
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from .ai.processing_manager import ProcessingManager
    from .metrics import MetricsDB

class FlaskApp(Flask):
    """Extended Flask class with custom attributes"""
    processing_manager: Optional['ProcessingManager']
    metrics_db: Optional['MetricsDB'] 