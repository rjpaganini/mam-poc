"""
Processing routes for the Media Asset Manager.
Handles AI processing requests and status updates.
"""

from flask import Blueprint, jsonify, request, current_app
from ..models import MediaAsset, ProcessingResult
from ..database import db
from typing import Tuple
from flask.wrappers import Response
import logging

# Configure logger
logger = logging.getLogger(__name__)

# Create blueprint
api = Blueprint('processing', __name__)

@api.route('/process/<int:asset_id>', methods=['POST'])
def start_processing(asset_id: int) -> Tuple[Response, int]:
    """Start processing for a media asset"""
    try:
        # Get the asset
        asset = MediaAsset.query.get_or_404(asset_id)
        
        # For now, just return success
        return jsonify({
            'status': 'success',
            'message': f'Processing queued for asset {asset_id}'
        }), 202
            
    except Exception as e:
        logger.error(f"Error starting processing for asset {asset_id}: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@api.route('/status/<int:asset_id>', methods=['GET'])
def get_processing_status(asset_id: int) -> Tuple[Response, int]:
    """Get processing status for a media asset"""
    try:
        # Get the latest processing result
        result = ProcessingResult.query.filter_by(
            asset_id=asset_id
        ).order_by(
            ProcessingResult.created_at.desc()
        ).first()
        
        if not result:
            return jsonify({
                'status': 'not_found',
                'message': f'No processing results found for asset {asset_id}'
            }), 404
            
        return jsonify({
            'status': 'success',
            'data': result.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting processing status for asset {asset_id}: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500