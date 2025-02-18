"""
backend/cloud/processing_manager.py
==========================================
Cloud Processing Manager for MAM System
==========================================

Handles video processing tasks using AWS services.
Coordinates between local frame extraction and cloud-based processing.

Key Components:
1. Frame Extraction: Intelligent scene-based sampling
2. Cloud Storage: Efficient frame storage in S3
3. Processing Pipeline: Async workflow management
4. Status Updates: Real-time progress monitoring
5. Cost Control: Rate limiting and usage tracking
6. Auto Cleanup: Automatic deletion of processed files

Author: Senior Developer
Date: 2024
"""

import os
import boto3
import json
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv
from frame_extractor import FrameExtractor
import asyncio
import logging
import uuid
import structlog
from datetime import datetime, timedelta
from botocore.exceptions import ClientError
import cv2
from collections import defaultdict

# Ensure logs directory exists
os.makedirs('logs', exist_ok=True)

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer()
    ]
)

# Processing-specific logger
processing_handler = logging.FileHandler('logs/processing.log')
processing_handler.setFormatter(
    logging.Formatter('%(asctime)s [%(levelname)s] %(message)s')
)
processing_logger = logging.getLogger('processing')
processing_logger.addHandler(processing_handler)
processing_logger.setLevel(logging.INFO)

# Performance metrics logger
performance_handler = logging.FileHandler('logs/performance.log')
performance_handler.setFormatter(
    logging.Formatter('%(asctime)s [%(levelname)s] %(message)s')
)
performance_logger = logging.getLogger('performance')
performance_logger.addHandler(performance_handler)
performance_logger.setLevel(logging.INFO)

# Error logger with detailed formatting
error_handler = logging.FileHandler('logs/error.log')
error_handler.setFormatter(
    logging.Formatter('%(asctime)s [%(levelname)s] [%(name)s] %(message)s\nStack: %(stack_info)s')
)
error_logger = logging.getLogger('error')
error_logger.addHandler(error_handler)
error_logger.setLevel(logging.ERROR)

# Main logger now uses structured logging
logger = structlog.get_logger('main')

# Load cloud configuration
load_dotenv(Path(__file__).parent / 'config.env')

class UsageTracker:
    """Tracks AWS service usage to stay within free tier limits"""
    
    def __init__(self):
        self.usage = defaultdict(int)
        self.limits = {
            'rekognition_images': 1000,  # Free tier: 1000 images/month
            's3_storage_mb': 5120,       # Free tier: 5GB
            's3_puts': 2000,             # Free tier: 2000 PUT requests
            's3_gets': 20000             # Free tier: 20000 GET requests
        }
        self.last_reset = datetime.utcnow()
    
    def check_limits(self, service: str, amount: int = 1) -> bool:
        """Check if operation would exceed free tier limits"""
        # Reset counters if it's a new month
        if self.last_reset.month != datetime.utcnow().month:
            self.usage = defaultdict(int)
            self.last_reset = datetime.utcnow()
        
        return self.usage[service] + amount <= self.limits.get(service, float('inf'))
    
    def record_usage(self, service: str, amount: int = 1):
        """Record usage of a service"""
        self.usage[service] += amount
        
    def get_usage_stats(self) -> Dict[str, Any]:
        """Get current usage statistics"""
        return {
            'usage': dict(self.usage),
            'limits': self.limits,
            'last_reset': self.last_reset.isoformat(),
            'usage_percentages': {
                service: (self.usage[service] / limit) * 100
                for service, limit in self.limits.items()
            }
        }

class ProcessingError(Exception):
    """Custom exception for processing errors with detailed context"""
    def __init__(self, message: str, error_type: str, context: Dict[str, Any]):
        self.error_type = error_type
        self.context = context
        self.timestamp = datetime.utcnow().isoformat()
        super().__init__(message)

class CloudProcessingManager:
    """Manages cloud-based video processing with cost controls"""
    
    def __init__(self):
        """Initialize AWS clients and processing components"""
        # Initialize logger
        self.logger = structlog.get_logger('cloud.processing')
        
        self.region = os.getenv('AWS_REGION', 'us-west-2')
        self.bucket = os.getenv('S3_BUCKET', 'mam-video-processing')
        self.webhook_url = os.getenv('WEBHOOK_URL', 'http://localhost:5001/api/v1/webhooks/processing')
        
        # Initialize AWS clients with error handling
        try:
            self.s3 = boto3.client('s3', region_name=self.region)
            self.lambda_client = boto3.client('lambda', region_name=self.region)
            
            # Validate AWS credentials
            self.s3.list_buckets()
            self.logger.info("AWS clients initialized successfully", 
                       region=self.region, 
                       bucket=self.bucket)
        except Exception as e:
            self.logger.error("Failed to initialize AWS clients", 
                        error=str(e), 
                        region=self.region)
            raise ProcessingError(
                message="AWS initialization failed",
                error_type="aws_init_error",
                context={"region": self.region, "error": str(e)}
            )
        
        # Processing settings with validation
        try:
            self.max_file_size = int(os.getenv('MAX_FILE_SIZE', 500000000))
            self.batch_size = int(os.getenv('BATCH_SIZE', 50))
            
            if self.batch_size < 1:
                raise ValueError("Batch size must be at least 1")
                
            self.logger.info("Processing settings loaded",
                       max_file_size=self.max_file_size,
                       batch_size=self.batch_size)
        except ValueError as e:
            self.logger.error("Invalid processing settings",
                        error=str(e))
            raise ProcessingError(
                message="Invalid processing settings",
                error_type="config_error",
                context={
                    "max_file_size": self.max_file_size,
                    "batch_size": self.batch_size
                }
            )
        
        # Initialize components with error tracking
        self.frame_extractor = FrameExtractor()  # No sample rate needed anymore
        self.processing_errors: List[Dict[str, Any]] = []
        self.processing_metrics: Dict[str, Any] = {
            "start_time": None,
            "frames_processed": 0,
            "batches_uploaded": 0,
            "errors_count": 0,
            "retries_count": 0
        }
        
        # Initialize usage tracker
        self.usage_tracker = UsageTracker()
        
        # Rate limiting settings
        self.rate_limit_delay = 0.1  # seconds between operations
        self.last_operation_time = defaultdict(float)
        
        # Cleanup settings
        self.cleanup_delay = 300  # 5 minutes after processing
        self.cleanup_tasks = []
    
    async def wait_for_rate_limit(self, operation: str):
        """Enforce rate limiting between operations"""
        elapsed = time.time() - self.last_operation_time[operation]
        if elapsed < self.rate_limit_delay:
            await asyncio.sleep(self.rate_limit_delay - elapsed)
        self.last_operation_time[operation] = time.time()
    
    async def cleanup_files(self, asset_id: str, delay: int = None):
        """Schedule cleanup of processed files"""
        if delay is None:
            delay = self.cleanup_delay
            
        await asyncio.sleep(delay)
        
        try:
            # Delete frame files
            response = self.s3.list_objects_v2(
                Bucket=self.bucket,
                Prefix=f"frames/{asset_id}/"
            )
            for obj in response.get('Contents', []):
                self.s3.delete_object(Bucket=self.bucket, Key=obj['Key'])
                self.logger.info(f"Cleaned up frame file: {obj['Key']}")
            
            # Keep only the latest result file
            response = self.s3.list_objects_v2(
                Bucket=self.bucket,
                Prefix=f"results/{asset_id}/"
            )
            objects = sorted(
                response.get('Contents', []),
                key=lambda x: x['LastModified'],
                reverse=True
            )
            
            # Delete all but the latest result
            for obj in objects[1:]:
                self.s3.delete_object(Bucket=self.bucket, Key=obj['Key'])
                self.logger.info(f"Cleaned up old result: {obj['Key']}")
                
        except Exception as e:
            self.logger.error(f"Cleanup failed: {e}")
    
    async def upload_frames_batch(self, frames: List[Dict], asset_id: str, batch_num: int) -> str:
        """Upload a batch of frames to S3 with usage tracking"""
        # Check S3 limits
        batch_size_mb = len(json.dumps(frames).encode()) / 1024 / 1024
        if not self.usage_tracker.check_limits('s3_storage_mb', int(batch_size_mb)):
            raise Exception("S3 storage limit reached")
        if not self.usage_tracker.check_limits('s3_puts'):
            raise Exception("S3 PUT request limit reached")
            
        # Apply rate limiting
        await self.wait_for_rate_limit('s3_put')
        
        # Create unique key for this batch
        key = f"frames/{asset_id}/batch_{batch_num}_{int(time.time())}.json"
        
        try:
            # Track upload start time
            start_time = time.time()
            
            # Upload frames batch to S3
            self.s3.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=json.dumps(frames),
                ContentType='application/json',
                Metadata={
                    'asset_id': asset_id,
                    'batch_number': str(batch_num),
                    'frame_count': str(len(frames))
                }
            )
            
            # Record usage
            self.usage_tracker.record_usage('s3_puts')
            self.usage_tracker.record_usage('s3_storage_mb', int(batch_size_mb))
            
            # Track successful upload
            upload_time = time.time() - start_time
            self.logger.info("Batch upload successful",
                       asset_id=asset_id,
                       batch_num=batch_num,
                       frame_count=len(frames),
                       upload_time=f"{upload_time:.2f}s",
                       s3_key=key)
            
            self.processing_metrics['batches_uploaded'] += 1
            self.processing_metrics['frames_processed'] += len(frames)
            
            return key
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_context = {
                'asset_id': asset_id,
                'batch_num': batch_num,
                'error_code': error_code,
                'bucket': self.bucket,
                'key': key
            }
            
            self.logger.error("S3 upload failed",
                        error_type="s3_error",
                        error_details=str(e),
                        **error_context)
            
            self.processing_errors.append({
                'timestamp': datetime.utcnow().isoformat(),
                'type': 'upload_error',
                'details': error_context,
                'message': str(e)
            })
            
            raise ProcessingError(
                message=f"Failed to upload batch {batch_num}",
                error_type="s3_upload_error",
                context=error_context
            )
            
        except Exception as e:
            self.logger.error("Unexpected error during upload",
                        error=str(e),
                        asset_id=asset_id,
                        batch_num=batch_num)
            raise
    
    async def trigger_lambda_processing(self, s3_key: str, asset_id: str) -> Dict[str, Any]:
        """
        Trigger Lambda function to process frames
        Args:
            s3_key: S3 key containing frames to process
            asset_id: Asset identifier
        Returns:
            Lambda response
        """
        try:
            # Prepare Lambda payload
            payload = {
                'Records': [{
                    's3': {
                        'bucket': {'name': self.bucket},
                        'object': {'key': s3_key}
                    }
                }],
                'asset_id': asset_id,
                'callback_url': f"{self.webhook_url}?asset_id={asset_id}"
            }
            
            # Invoke Lambda asynchronously
            response = self.lambda_client.invoke(
                FunctionName='process-video-frames',
                InvocationType='Event',  # Async invocation
                Payload=json.dumps(payload)
            )
            
            return {
                'status': 'processing',
                'batch_key': s3_key,
                'request_id': response.get('ResponseMetadata', {}).get('RequestId')
            }
            
        except Exception as e:
            self.logger.error(f"Failed to trigger Lambda: {e}")
            raise
    
    async def process_video(self, file_path: str, asset_id: str) -> Dict[str, Any]:
        """Process a video file through the cloud pipeline with usage tracking"""
        try:
            # Start cleanup task
            cleanup_task = asyncio.create_task(
                self.cleanup_files(asset_id)
            )
            self.cleanup_tasks.append(cleanup_task)
            
            self.logger.info("Starting video processing",
                       file_path=file_path,
                       settings={
                           'max_file_size': self.max_file_size,
                           'batch_size': self.batch_size
                       })
            
            # Initialize processing session
            self.processing_metrics['start_time'] = datetime.utcnow().isoformat()
            
            # Validate file size
            file_size = os.path.getsize(file_path)
            if file_size > self.max_file_size:
                raise ProcessingError(
                    message=f"File exceeds {self.max_file_size/1e6}MB limit",
                    error_type="file_size_error",
                    context={'file_size': file_size, 'max_size': self.max_file_size}
                )
            
            # Get video properties
            cap = cv2.VideoCapture(file_path)
            if not cap.isOpened():
                raise ProcessingError(
                    message="Failed to open video file",
                    error_type="video_open_error",
                    context={'file_path': file_path}
                )
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            cap.release()
            
            # Extract scenes for intelligent sampling
            try:
                scenes = await self.frame_extractor.extract_scenes(file_path)
                self.logger.info("Scene detection complete",
                           asset_id=asset_id,
                           scene_count=len(scenes))
            except Exception as e:
                self.logger.error("Scene detection failed",
                            error=str(e),
                            asset_id=asset_id)
                scenes = []  # Fallback to basic processing
            
            # Process and upload frames in batches
            current_batch = []
            batch_num = 0
            total_frames = 0
            processing_tasks = []
            processing_start = time.time()
            
            async for frame_data in self.frame_extractor.extract_frames(file_path):
                try:
                    # Convert frame to bytes for storage
                    frame_bytes = self.frame_extractor.frame_to_bytes(frame_data['frame'])
                    frame_data['frame'] = frame_bytes.decode('latin1')
                    current_batch.append(frame_data)
                    total_frames += 1
                    
                    # Upload batch when full
                    if len(current_batch) >= self.batch_size:
                        batch_num += 1
                        # Upload batch and trigger processing
                        s3_key = await self.upload_frames_batch(current_batch, asset_id, batch_num)
                        task = self.trigger_lambda_processing(s3_key, asset_id)
                        processing_tasks.append(task)
                        current_batch = []
                        
                        # Log progress
                        progress = (total_frames / frame_count) * 100 if frame_count > 0 else 0
                        self.logger.info("Processing progress",
                                  asset_id=asset_id,
                                  batch_num=batch_num,
                                  frames_processed=total_frames,
                                  progress=f"{progress:.1f}%")
                        
                except Exception as e:
                    self.logger.error("Frame processing error",
                               error=str(e),
                               asset_id=asset_id,
                               batch_num=batch_num,
                               frame_number=total_frames)
                    self.processing_errors.append({
                        'timestamp': datetime.utcnow().isoformat(),
                        'type': 'frame_processing_error',
                        'details': {
                            'frame_number': total_frames,
                            'batch_number': batch_num
                        },
                        'message': str(e)
                    })
                    continue
            
            # Upload final batch if any frames remain
            if current_batch:
                batch_num += 1
                s3_key = await self.upload_frames_batch(current_batch, asset_id, batch_num)
                task = self.trigger_lambda_processing(s3_key, asset_id)
                processing_tasks.append(task)
            
            # Wait for all Lambda triggers to complete
            results = await asyncio.gather(*processing_tasks, return_exceptions=True)
            
            # Calculate processing metrics
            processing_time = time.time() - processing_start
            frames_per_second = total_frames / processing_time if processing_time > 0 else 0
            
            # Compile final results
            final_results = {
                'status': 'processing',
                'asset_id': asset_id,
                'scenes_detected': len(scenes),
                'frames_processed': total_frames,
                'batches_uploaded': batch_num,
                'processing_time': processing_time,
                'frames_per_second': frames_per_second,
                'errors': self.processing_errors,
                'lambda_triggers': [r for r in results if not isinstance(r, Exception)],
                'metrics': self.processing_metrics,
                'usage_stats': self.usage_tracker.get_usage_stats()
            }
            
            # Fixed: Pass final_results without asset_id to avoid duplication
            log_results = {k: v for k, v in final_results.items() if k != 'asset_id'}
            self.logger.info("Processing complete",
                       asset_id=asset_id,
                       **log_results)
            
            return final_results
            
        except Exception as e:
            error_details = {
                'status': 'error',
                'asset_id': asset_id,
                'error': str(e),
                'error_type': type(e).__name__,
                'errors': self.processing_errors
            }
            # Fixed: Log error without asset_id to avoid duplication
            self.logger.error("Processing failed",
                        error=str(e),
                        traceback=True)
            return {
                'status': 'error',
                'error': str(e),
                'usage_stats': self.usage_tracker.get_usage_stats()
            }
    
    @staticmethod
    def is_enabled() -> bool:
        """Check if cloud processing is enabled"""
        return os.getenv('CLOUD_ENABLED', 'false').lower() == 'true'

    def get_usage_stats(self) -> Dict[str, Any]:
        """Get current usage statistics"""
        return self.usage_tracker.get_usage_stats()

# Create singleton instance
processing_manager = CloudProcessingManager() 