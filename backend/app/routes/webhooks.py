"""
backend/app/routes/webhooks.py
==========================================
Webhook Routes for Cloud Processing Results
==========================================

Handles incoming webhooks from AWS Lambda with processing results.
Updates local database and notifies clients via WebSocket.

Author: Senior Developer
Date: 2024
"""

from flask import Blueprint, request, jsonify
from ..database import db
from ..models import MediaAsset as Asset, ProcessingResult
from ..websocket import send_processing_update
import logging

# Initialize blueprint and logger
webhooks = Blueprint('webhooks', __name__)
logger = logging.getLogger(__name__)

@webhooks.route('/api/v1/webhooks/processing', methods=['POST'])
def handle_processing_webhook():
    """Handle incoming processing results from Lambda"""
    try:
        # Get asset ID from query params
        asset_id = request.args.get('asset_id')
        if not asset_id:
            return jsonify({'error': 'Missing asset_id parameter'}), 400
            
        # Get results from request body
        results = request.json.get('results', [])
        if not results:
            return jsonify({'error': 'No results provided'}), 400
            
        # Update asset in database
        asset = Asset.query.get(asset_id)
        if not asset:
            return jsonify({'error': 'Asset not found'}), 404
            
        # Create processing result record
        processing_result = ProcessingResult(
            asset_id=asset_id,
            results=results,
            status='completed'
        )
        
        # Update asset metadata
        asset.media_metadata['ai_metadata'] = {
            'processed_at': processing_result.created_at.isoformat(),
            'results': results
        }
        
        # Save to database
        db.session.add(processing_result)
        db.session.commit()
        
        # Notify clients via WebSocket
        send_processing_update({
            'type': 'processing_complete',
            'asset_id': asset_id,
            'results_count': len(results)
        })
        
        logger.info(f"Processing complete for asset {asset_id}")
        return jsonify({'status': 'success', 'message': 'Results processed'})
        
    except Exception as e:
        logger.error(f"Error handling webhook: {e}")
        return jsonify({'error': str(e)}), 500 