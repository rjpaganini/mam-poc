"""
AWS Metrics Collector
===================

Collects detailed metrics from AWS services:
- Lambda execution metrics and performance
- S3 usage and latency statistics
- Rekognition API performance and accuracy
- Cost estimates and projections
"""

import boto3
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from .models import MetricsDB

logger = logging.getLogger(__name__)

class MetricsCollector:
    """Collects and stores detailed AWS service metrics"""
    
    def __init__(self, metrics_db: MetricsDB):
        """Initialize collector with database connection"""
        self.db = metrics_db
        self.cloudwatch = boto3.client('cloudwatch')
        self.lambda_client = boto3.client('lambda')
        self.s3 = boto3.client('s3')
        
        # Enhanced metric definitions
        self.lambda_metrics = [
            {'name': 'Duration', 'stat': 'Average', 'unit': 'Milliseconds'},
            {'name': 'Errors', 'stat': 'Sum', 'unit': 'Count'},
            {'name': 'Throttles', 'stat': 'Sum', 'unit': 'Count'},
            {'name': 'ConcurrentExecutions', 'stat': 'Maximum', 'unit': 'Count'},
            {'name': 'IteratorAge', 'stat': 'Maximum', 'unit': 'Milliseconds'},
            {'name': 'DeadLetterErrors', 'stat': 'Sum', 'unit': 'Count'}
        ]
        
        self.s3_metrics = [
            {'name': 'BytesDownloaded', 'stat': 'Sum', 'unit': 'Bytes'},
            {'name': 'BytesUploaded', 'stat': 'Sum', 'unit': 'Bytes'},
            {'name': 'RequestLatency', 'stat': 'Average', 'unit': 'Milliseconds'},
            {'name': '4xxErrors', 'stat': 'Sum', 'unit': 'Count'},
            {'name': '5xxErrors', 'stat': 'Sum', 'unit': 'Count'}
        ]
        
        # Alert thresholds
        self.thresholds = {
            'lambda': {
                'error_rate': 5.0,  # 5% error rate
                'throttle_rate': 2.0,  # 2% throttle rate
                'duration_p95': 1000,  # 1 second
                'concurrent_executions': 500  # 500 concurrent executions
            },
            's3': {
                'error_rate': 1.0,  # 1% error rate
                'latency_p95': 200,  # 200ms
                'daily_cost': 1.0  # $1 per day
            },
            'rekognition': {
                'error_rate': 1.0,  # 1% error rate
                'confidence_threshold': 80.0  # 80% confidence
            }
        }
    
    async def collect_lambda_metrics(self, function_name: str = "process-video-frames"):
        """Collect comprehensive Lambda metrics"""
        try:
            queries = []
            for metric in self.lambda_metrics:
                queries.append({
                    'Id': metric['name'].lower(),
                    'MetricStat': {
                        'Metric': {
                            'Namespace': 'AWS/Lambda',
                            'MetricName': metric['name'],
                            'Dimensions': [
                                {'Name': 'FunctionName', 'Value': function_name}
                            ]
                        },
                        'Period': 300,  # 5-minute periods
                        'Stat': metric['stat'],
                        'Unit': metric['unit']
                    }
                })
            
            # Get metrics data
            metrics = self.cloudwatch.get_metric_data(
                MetricDataQueries=queries,
                StartTime=datetime.utcnow() - timedelta(hours=1),
                EndTime=datetime.utcnow()
            )
            
            # Process and store metrics
            for i, metric in enumerate(self.lambda_metrics):
                values = metrics['MetricDataResults'][i]['Values']
                if values:
                    self.db.record_lambda_metric(
                        function_name=function_name,
                        metric_name=metric['name'],
                        value=values[-1],  # Latest value
                        timestamp=datetime.utcnow(),
                        metadata={
                            'unit': metric['unit'],
                            'stat': metric['stat']
                        }
                    )
            
            # Check thresholds and record alerts
            self._check_lambda_thresholds(metrics, function_name)
            
        except Exception as e:
            logger.error(f"Failed to collect Lambda metrics: {e}")
    
    def _check_lambda_thresholds(self, metrics: Dict, function_name: str):
        """Check Lambda metrics against thresholds"""
        try:
            # Calculate error rate
            invocations = sum(metrics['MetricDataResults'][0]['Values'])
            errors = sum(metrics['MetricDataResults'][1]['Values'])
            if invocations > 0:
                error_rate = (errors / invocations) * 100
                if error_rate > self.thresholds['lambda']['error_rate']:
                    self.db.record_alert(
                        service='lambda',
                        alert_type='error_rate',
                        value=error_rate,
                        threshold=self.thresholds['lambda']['error_rate'],
                        metadata={
                            'function_name': function_name,
                            'invocations': invocations,
                            'errors': errors
                        }
                    )
            
            # Check other thresholds...
            
        except Exception as e:
            logger.error(f"Failed to check Lambda thresholds: {e}")
    
    async def collect_s3_metrics(self, bucket_name: str = None):
        """Collect detailed S3 metrics"""
        try:
            if bucket_name is None:
                bucket_name = self.s3.list_buckets()['Buckets'][0]['Name']
            
            queries = []
            for metric in self.s3_metrics:
                queries.append({
                    'Id': metric['name'].lower(),
                    'MetricStat': {
                        'Metric': {
                            'Namespace': 'AWS/S3',
                            'MetricName': metric['name'],
                            'Dimensions': [
                                {'Name': 'BucketName', 'Value': bucket_name}
                            ]
                        },
                        'Period': 300,
                        'Stat': metric['stat'],
                        'Unit': metric['unit']
                    }
                })
            
            # Get metrics data
            metrics = self.cloudwatch.get_metric_data(
                MetricDataQueries=queries,
                StartTime=datetime.utcnow() - timedelta(hours=1),
                EndTime=datetime.utcnow()
            )
            
            # Process and store metrics
            for i, metric in enumerate(self.s3_metrics):
                values = metrics['MetricDataResults'][i]['Values']
                if values:
                    self.db.record_s3_metric(
                        bucket_name=bucket_name,
                        metric_name=metric['name'],
                        value=values[-1],
                        timestamp=datetime.utcnow(),
                        metadata={
                            'unit': metric['unit'],
                            'stat': metric['stat']
                        }
                    )
            
            # Check thresholds
            self._check_s3_thresholds(metrics, bucket_name)
            
        except Exception as e:
            logger.error(f"Failed to collect S3 metrics: {e}")
    
    async def collect_rekognition_metrics(self):
        """Collect Rekognition usage metrics"""
        try:
            # Get API calls from CloudWatch
            metrics = self.cloudwatch.get_metric_statistics(
                Namespace='AWS/Rekognition',
                MetricName='SuccessfulRequestCount',
                StartTime=datetime.utcnow() - timedelta(days=1),
                EndTime=datetime.utcnow(),
                Period=3600,
                Statistics=['Sum']
            )
            
            if metrics['Datapoints']:
                requests = int(metrics['Datapoints'][0]['Sum'])
                
                # Record usage
                self.db.record_service_usage(
                    service='rekognition',
                    operation='detect_labels',
                    amount=requests
                )
                
                # Calculate cost if exceeding free tier
                if requests > self.pricing['rekognition']['free_tier_images']:
                    cost = (
                        (requests - self.pricing['rekognition']['free_tier_images']) *
                        self.pricing['rekognition']['cost_per_image']
                    )
                    self.db.record_cost(
                        service='rekognition',
                        cost_usd=cost,
                        usage_amount=requests
                    )
            
        except Exception as e:
            logger.error(f"Failed to collect Rekognition metrics: {e}")
    
    async def collect_all_metrics(self):
        """Collect all AWS service metrics"""
        try:
            await self.collect_lambda_metrics()
            await self.collect_s3_metrics()
            await self.collect_rekognition_metrics()
            logger.info("Successfully collected all AWS metrics")
        except Exception as e:
            logger.error(f"Failed to collect metrics: {e}") 