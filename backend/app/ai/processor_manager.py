"""
backend/app/ai/processor_manager.py

This module provides centralized management of AI processors for the Media Asset Management system.
It handles processor lifecycle, configuration, and execution coordination.

Key Features:
- Processor instantiation and configuration
- Processor lifecycle management
- Execution coordination
- Resource management
- Error handling and logging

Author: AI Assistant
Date: February 2024
"""

import logging
from typing import Dict, Any, List, Optional, Type
from concurrent.futures import ThreadPoolExecutor
import asyncio
import os
import multiprocessing

from .processors.base_processor import BaseProcessor
from .processors.scene_processor import SceneProcessor
from .processors.logo_processor import LogoProcessor

class ProcessorManager:
    """
    Manages AI processors for media analysis.
    
    This class handles the lifecycle and coordination of various AI processors,
    ensuring efficient resource usage and proper error handling.
    
    Attributes:
        processors (Dict[str, BaseProcessor]): Active processor instances
        max_workers (int): Maximum concurrent processing threads
        logger (logging.Logger): Manager-specific logger
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize with adaptive worker scaling"""
        self.logger = logging.getLogger(__name__)
        self.config = config or {}
        self.processors = {}
        
        # Calculate optimal worker count based on CPU cores and memory
        cpu_count = multiprocessing.cpu_count()
        self.max_workers = min(
            cpu_count,  # Don't exceed CPU count
            self.config.get('max_workers', cpu_count - 1)  # Leave one core free
        )
        
        # Initialize processor pool with adaptive sizing
        self.executor = ThreadPoolExecutor(
            max_workers=self.max_workers,
            thread_name_prefix="AIProcessor"
        )
        
        self._initialize_processors()
        
        self.logger.info(
            f"Initialized ProcessorManager with {len(self.processors)} processors, "
            f"max_workers={self.max_workers} (auto-scaled)"
        )
    
    def _initialize_processors(self) -> None:
        """Initialize default set of processors."""
        # Initialize with default configurations
        self.register_processor(
            'scene',
            SceneProcessor(self.config.get('scene_processor', {}))
        )
        
        self.register_processor(
            'logo',
            LogoProcessor(self.config.get('logo_processor', {}))
        )
    
    def register_processor(
        self, 
        name: str, 
        processor: BaseProcessor
    ) -> None:
        """
        Register a new processor instance.
        
        Args:
            name (str): Unique name for the processor
            processor (BaseProcessor): Processor instance
        """
        if name in self.processors:
            self.logger.warning(f"Overwriting existing processor: {name}")
        
        self.processors[name] = processor
        self.logger.info(f"Registered processor: {name}")
    
    def get_processor(self, name: str) -> Optional[BaseProcessor]:
        """
        Get a processor by name.
        
        Args:
            name (str): Name of the processor
            
        Returns:
            Optional[BaseProcessor]: The processor instance if found
        """
        return self.processors.get(name)
    
    def list_processors(self) -> List[str]:
        """Get list of available processors."""
        return list(self.processors.keys())
    
    async def process_media(
        self,
        file_path: str,
        processors: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Process media with adaptive chunking for large files"""
        if processors is None:
            processors = self.list_processors()
            
        results = {}
        tasks = []
        
        # Get file size for adaptive processing
        file_size = os.path.getsize(file_path)
        
        # Adjust chunk size based on file size (larger chunks for smaller files)
        chunk_size = max(
            1024 * 1024,  # 1MB minimum
            min(file_size // 10, 50 * 1024 * 1024)  # Max 50MB chunks
        )
        
        for name in processors:
            processor = self.get_processor(name)
            if not processor:
                self.logger.warning(f"Processor not found: {name}")
                continue
                
            if not processor.is_enabled():
                self.logger.info(f"Skipping disabled processor: {name}")
                continue
            
            # Create processing task with chunk information
            task = asyncio.create_task(
                self._process_with_timeout(
                    name, 
                    processor, 
                    file_path,
                    chunk_size=chunk_size
                )
            )
            tasks.append(task)
        
        # Wait for all tasks to complete
        completed_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        for name, result in zip(processors, completed_results):
            if isinstance(result, Exception):
                self.logger.error(f"Processor {name} failed: {str(result)}")
                results[name] = {
                    'status': 'error',
                    'error': str(result)
                }
            else:
                results[name] = {
                    'status': 'success',
                    'data': result
                }
        
        return results
    
    async def _process_with_timeout(
        self,
        name: str,
        processor: BaseProcessor,
        file_path: str,
        chunk_size: int = 10 * 1024 * 1024,  # Default 10MB chunks
        timeout: float = 300.0
    ) -> Dict[str, Any]:
        """Process media in chunks with timeout"""
        try:
            # Run processor with timeout and chunk information
            result = await asyncio.wait_for(
                processor.process(
                    file_path,
                    chunk_size=chunk_size
                ),
                timeout=timeout
            )
            
            return result
            
        except asyncio.TimeoutError:
            self.logger.error(
                f"Processor {name} timed out after {timeout} seconds"
            )
            raise TimeoutError(
                f"Processing timed out for {name} after {timeout} seconds"
            )
        
        except Exception as e:
            self.logger.error(f"Processor {name} failed: {str(e)}")
            raise
    
    def update_processor_config(
        self,
        name: str,
        config: Dict[str, Any]
    ) -> bool:
        """
        Update configuration for a specific processor.
        
        Args:
            name (str): Processor name
            config (Dict[str, Any]): New configuration
            
        Returns:
            bool: True if update successful
        """
        processor = self.get_processor(name)
        if not processor:
            self.logger.warning(f"Processor not found: {name}")
            return False
        
        try:
            processor.update_config(config)
            return True
        except Exception as e:
            self.logger.error(
                f"Failed to update config for {name}: {str(e)}"
            )
            return False
    
    def shutdown(self) -> None:
        """Clean up resources and shut down processors."""
        self.logger.info("Shutting down ProcessorManager")
        self.executor.shutdown(wait=True)
        for name, processor in self.processors.items():
            try:
                processor.disable()
            except Exception as e:
                self.logger.error(
                    f"Error disabling processor {name}: {str(e)}"
                ) 