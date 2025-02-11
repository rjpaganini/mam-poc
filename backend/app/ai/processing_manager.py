"""
backend/app/ai/processing_manager.py

Manages the AI processing pipeline for media assets.
Coordinates metadata extraction, scene detection, and logo detection.
Provides real-time progress updates via WebSocket.

Author: AI Assistant
Date: February 2024
"""

import asyncio
from typing import Dict, Any, Optional, List
import logging
from datetime import datetime
from pathlib import Path

from ..database import db
from ..models import MediaAsset
from ..websocket import broadcast_message as send_ws_message
from .processor_manager import ProcessorManager
from ..utils.extract_metadata import extract_enhanced_metadata

logger = logging.getLogger(__name__)

class ProcessingManager:
    """
    Manages the AI processing pipeline for media assets.
    Handles the workflow from initial scan to AI processing completion.
    """
    
    def __init__(self):
        """Initialize the processing manager."""
        self.processor_manager = ProcessorManager()
        self._processing_queue = asyncio.Queue()
        self._is_processing = False
        self._processing_tasks: List[asyncio.Task] = []
        self.MAX_CONCURRENT_TASKS = 3  # Maximum number of concurrent processing tasks
    
    async def start_processing_worker(self):
        """Start the background processing worker."""
        self._is_processing = True
        while self._is_processing:
            try:
                # Get next asset from queue
                asset_id = await self._processing_queue.get()
                
                try:
                    # Process the asset
                    await self._process_asset(asset_id)
                except Exception as e:
                    logger.error(f"Error processing asset {asset_id}: {str(e)}")
                    await send_ws_message({
                        'type': 'processing_error',
                        'asset_id': asset_id,
                        'error': str(e)
                    })
                finally:
                    self._processing_queue.task_done()
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Processing worker error: {str(e)}")
                await asyncio.sleep(1)  # Prevent tight loop on error
    
    async def stop_processing_worker(self):
        """Stop the background processing worker."""
        self._is_processing = False
    
    async def queue_asset(self, asset_id: int):
        """
        Queue an asset for processing.
        
        Args:
            asset_id: ID of the asset to process
        """
        await self._processing_queue.put(asset_id)
    
    async def _process_asset(self, asset_id: int):
        """
        Process a single asset through the pipeline.
        
        Args:
            asset_id: ID of the asset to process
        """
        asset = MediaAsset.query.get(asset_id)
        if not asset:
            logger.error(f"Asset not found: {asset_id}")
            return
        
        try:
            # Update processing status
            await send_ws_message({
                'type': 'processing_update',
                'asset_id': asset_id,
                'asset_name': asset.title,
                'stage': 'METADATA',
                'progress': 0
            })
            
            # Extract enhanced metadata
            metadata = await extract_enhanced_metadata(asset.file_path)
            if not metadata:
                raise RuntimeError("Failed to extract metadata")
            
            # Update asset with metadata
            asset.media_metadata = metadata
            db.session.commit()
            
            # Update progress
            await send_ws_message({
                'type': 'processing_update',
                'asset_id': asset_id,
                'asset_name': asset.title,
                'stage': 'SCENE_DETECTION',
                'progress': 33
            })
            
            # Process with AI processors
            ai_results = await self.processor_manager.process_media(
                asset.file_path,
                processors=['scene']
            )
            
            # Update progress
            await send_ws_message({
                'type': 'processing_update',
                'asset_id': asset_id,
                'asset_name': asset.title,
                'stage': 'LOGO_DETECTION',
                'progress': 66
            })
            
            # Process logos
            logo_results = await self.processor_manager.process_media(
                asset.file_path,
                processors=['logo']
            )
            
            # Combine results
            if ai_results and logo_results:
                ai_results.update(logo_results)
            
            # Update asset with AI results
            if ai_results:
                metadata['ai_metadata'] = {
                    processor: data['data'] if data['status'] == 'success' else None
                    for processor, data in ai_results.items()
                }
                metadata['ai_metadata']['processed_at'] = datetime.utcnow().isoformat()
                
                asset.media_metadata = metadata
                db.session.commit()
            
            # Send completion message
            await send_ws_message({
                'type': 'processing_update',
                'asset_id': asset_id,
                'asset_name': asset.title,
                'stage': 'COMPLETE',
                'progress': 100
            })
            
        except Exception as e:
            logger.error(f"Error processing asset {asset_id}: {str(e)}")
            await send_ws_message({
                'type': 'processing_error',
                'asset_id': asset_id,
                'asset_name': asset.title,
                'error': str(e)
            })
            raise

    def get_queue_status(self) -> Dict[str, Any]:
        """Get current processing queue status.
        
        Returns:
            Dict containing queue statistics
        """
        try:
            # Get active processing tasks
            active_tasks = len([task for task in self._processing_tasks if not task.done()])
            
            return {
                'active_tasks': active_tasks,
                'status': 'healthy' if active_tasks < self.MAX_CONCURRENT_TASKS else 'busy',
                'max_concurrent': self.MAX_CONCURRENT_TASKS,
                'last_update': datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Error getting queue status: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }

# Create singleton instance
processing_manager = ProcessingManager() 