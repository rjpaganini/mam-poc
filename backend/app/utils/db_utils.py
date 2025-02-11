"""
Database utilities for consistent access to the merged database.
Ensures all metadata operations use the enhanced schema.
"""

from flask import current_app
from ..models import MediaAsset, ProcessingResult, db
from datetime import datetime
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

def update_asset_metadata(asset_id: int, metadata: Dict[str, Any]) -> bool:
    """
    Update asset metadata in the merged database.
    
    Args:
        asset_id: ID of the media asset
        metadata: Dictionary containing metadata fields
        
    Returns:
        bool: True if update successful, False otherwise
    """
    try:
        asset = MediaAsset.query.get(asset_id)
        if not asset:
            logger.error(f"Asset not found: {asset_id}")
            return False
            
        # Update normalized columns
        for field in [
            'title', 'file_size', 'file_size_mb', 'format',
            'duration', 'duration_formatted', 'width', 'height',
            'fps', 'codec', 'container_format', 'bit_rate',
            'audio_codec', 'audio_channels', 'audio_sample_rate'
        ]:
            if field in metadata:
                setattr(asset, field, metadata[field])
                
        # Record processing result
        result = ProcessingResult(
            asset_id=asset_id,
            processor_name='metadata_extractor',
            status='completed',
            result_data=metadata,
            created_at=datetime.utcnow()
        )
        
        db.session.add(result)
        db.session.commit()
        
        logger.info(f"Updated metadata for asset {asset_id}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to update metadata for asset {asset_id}: {e}")
        db.session.rollback()
        return False

def get_asset_metadata(asset_id: int) -> Optional[Dict[str, Any]]:
    """
    Get complete asset metadata including processing results.
    
    Args:
        asset_id: ID of the media asset
        
    Returns:
        Optional[Dict]: Asset metadata or None if not found
    """
    try:
        asset = MediaAsset.query.get(asset_id)
        if not asset:
            return None
            
        # Get base metadata
        metadata = asset.to_dict()
        
        # Add processing results
        results = ProcessingResult.query.filter_by(
            asset_id=asset_id,
            status='completed'
        ).order_by(ProcessingResult.created_at.desc()).all()
        
        metadata['processing_results'] = [r.to_dict() for r in results]
        
        return metadata
        
    except Exception as e:
        logger.error(f"Failed to get metadata for asset {asset_id}: {e}")
        return None 