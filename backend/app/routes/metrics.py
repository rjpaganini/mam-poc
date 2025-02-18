"""
Metrics API Routes
================

Exposes AWS usage metrics to the frontend through REST endpoints.
Provides detailed metrics, alerts, and threshold status.
"""

from flask import Blueprint, jsonify, current_app, request
from typing import Tuple
from flask.wrappers import Response
import logging
from ..metrics import MetricsDB

# Configure logger
logger = logging.getLogger(__name__)

# Create blueprint
metrics_api = Blueprint('metrics', __name__)

@metrics_api.route('/metrics/usage', methods=['GET'])
def get_usage_metrics() -> Tuple[Response, int]:
    """Get AWS service usage metrics"""
    try:
        days = request.args.get('days', default=30, type=int)
        service = request.args.get('service', default=None, type=str)
        
        metrics_db = current_app.metrics_db
        usage = metrics_db.get_service_usage(service=service, days=days)
        
        return jsonify({
            'status': 'success',
            'data': usage
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get usage metrics: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@metrics_api.route('/metrics/lambda', methods=['GET'])
def get_lambda_metrics() -> Tuple[Response, int]:
    """Get detailed Lambda function metrics"""
    try:
        hours = request.args.get('hours', default=24, type=int)
        function_name = request.args.get('function', default=None, type=str)
        
        metrics_db = current_app.metrics_db
        metrics = metrics_db.get_lambda_metrics(
            function_name=function_name,
            hours=hours
        )
        
        # Group metrics by function
        grouped_metrics = {}
        for metric in metrics:
            fn_name = metric['function_name']
            if fn_name not in grouped_metrics:
                grouped_metrics[fn_name] = {
                    'function_name': fn_name,
                    'metrics': {}
                }
            grouped_metrics[fn_name]['metrics'][metric['metric_name']] = {
                'avg_value': metric['avg_value'],
                'max_value': metric['max_value'],
                'min_value': metric['min_value'],
                'sample_count': metric['sample_count'],
                'time_series': metric['time_series']
            }
        
        return jsonify({
            'status': 'success',
            'data': list(grouped_metrics.values())
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get Lambda metrics: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@metrics_api.route('/metrics/s3', methods=['GET'])
def get_s3_metrics() -> Tuple[Response, int]:
    """Get detailed S3 metrics"""
    try:
        hours = request.args.get('hours', default=24, type=int)
        bucket = request.args.get('bucket', default=None, type=str)
        metric = request.args.get('metric', default=None, type=str)
        
        metrics_db = current_app.metrics_db
        metrics = metrics_db.get_s3_metrics(
            bucket_name=bucket,
            metric_name=metric,
            hours=hours
        )
        
        # Group metrics by bucket
        grouped_metrics = {}
        for m in metrics:
            bucket_name = m['bucket_name']
            if bucket_name not in grouped_metrics:
                grouped_metrics[bucket_name] = {
                    'bucket_name': bucket_name,
                    'metrics': {}
                }
            grouped_metrics[bucket_name]['metrics'][m['metric_name']] = {
                'avg_value': m['avg_value'],
                'max_value': m['max_value'],
                'min_value': m['min_value'],
                'sample_count': m['sample_count'],
                'time_series': m['time_series']
            }
        
        return jsonify({
            'status': 'success',
            'data': list(grouped_metrics.values())
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get S3 metrics: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@metrics_api.route('/metrics/costs', methods=['GET'])
def get_cost_metrics() -> Tuple[Response, int]:
    """Get AWS cost metrics"""
    try:
        days = request.args.get('days', default=30, type=int)
        
        metrics_db = current_app.metrics_db
        costs = metrics_db.get_costs(days=days)
        
        return jsonify({
            'status': 'success',
            'data': costs
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get cost metrics: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@metrics_api.route('/metrics/alerts', methods=['GET'])
def get_alerts() -> Tuple[Response, int]:
    """Get recent alerts"""
    try:
        hours = request.args.get('hours', default=24, type=int)
        service = request.args.get('service', default=None, type=str)
        
        metrics_db = current_app.metrics_db
        alerts = metrics_db.get_alerts(
            service=service,
            hours=hours
        )
        
        return jsonify({
            'status': 'success',
            'data': alerts
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get alerts: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500 