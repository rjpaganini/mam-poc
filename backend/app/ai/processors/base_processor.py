"""
backend/app/ai/processors/base_processor.py

This module defines the base class for all AI processors in the Media Asset Management system.
It provides a common interface and shared functionality for different types of media analysis.

Key Features:
- Abstract base class for all AI processors
- Common utility methods for video processing
- Error handling and logging infrastructure
- Resource management for AI processing
- Chunk-based processing for large files

Author: AI Assistant
Date: February 2024
"""

from abc import ABC, abstractmethod
import logging
from typing import Dict, Any, Optional, Generator
import os
from pathlib import Path

# Configure logging
logger = logging.getLogger(__name__)

class BaseProcessor(ABC):
    """
    Abstract base class for all AI processors in the system.
    
    This class defines the interface that all AI processors must implement
    and provides common utility methods for video processing tasks.
    
    Attributes:
        name (str): Name of the processor
        enabled (bool): Whether this processor is currently enabled
        config (Dict[str, Any]): Configuration parameters for the processor
    """
    
    def __init__(self, name: str, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the base processor.
        
        Args:
            name (str): Name of this processor
            config (Dict[str, Any], optional): Configuration parameters
        """
        self.name = name
        self.enabled = True
        self.config = config or {}
        
        # Initialize logging for this processor
        self._setup_logging()
    
    def _setup_logging(self) -> None:
        """Configure processor-specific logging."""
        self.logger = logging.getLogger(f"{__name__}.{self.name}")
    
    @abstractmethod
    async def process(
        self, 
        file_path: str,
        chunk_size: int = 10 * 1024 * 1024  # Default 10MB chunks
    ) -> Dict[str, Any]:
        """
        Process a media file with chunk support.
        
        Args:
            file_path (str): Path to the media file to process
            chunk_size (int, optional): Size of each chunk in bytes
            
        Returns:
            Dict[str, Any]: Extracted metadata and analysis results
            
        Raises:
            FileNotFoundError: If the input file doesn't exist
            ValueError: If the input file is invalid
            RuntimeError: If processing fails
        """
        pass
    
    def _get_chunks(
        self, 
        file_path: str, 
        chunk_size: int
    ) -> Generator[bytes, None, None]:
        """
        Generate chunks from file for memory-efficient processing.
        
        Args:
            file_path: Path to media file
            chunk_size: Size of each chunk in bytes
            
        Yields:
            bytes: Next chunk of file data
        """
        with open(file_path, 'rb') as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                yield chunk
    
    def validate_input(self, file_path: str) -> None:
        """
        Validate input file exists and is accessible.
        
        Args:
            file_path: Path to media file to validate
            
        Raises:
            FileNotFoundError: If file doesn't exist
            ValueError: If file is empty or invalid
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
            
        if os.path.getsize(file_path) == 0:
            raise ValueError(f"Empty file: {file_path}")
    
    def is_enabled(self) -> bool:
        """Check if this processor is enabled."""
        return self.enabled
    
    def enable(self) -> None:
        """Enable this processor."""
        self.enabled = True
        self.logger.info(f"Enabled {self.name} processor")
    
    def disable(self) -> None:
        """Disable this processor."""
        self.enabled = False
        self.logger.info(f"Disabled {self.name} processor")
    
    def get_config(self) -> Dict[str, Any]:
        """Get the current configuration."""
        return self.config
    
    def update_config(self, new_config: Dict[str, Any]) -> None:
        """
        Update the processor configuration.
        
        Args:
            new_config (Dict[str, Any]): New configuration parameters
        """
        self.config.update(new_config)
        self.logger.info(f"Updated configuration for {self.name} processor") 