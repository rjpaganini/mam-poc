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
from .frame_extractor import FrameExtractor
import asyncio
import logging
import uuid
import structlog
from datetime import datetime
from botocore.exceptions import ClientError

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

class ProcessingError(Exception):
    """Custom exception for processing errors with detailed context"""
    def __init__(self, message: str, error_type: str, context: Dict[str, Any]):
        self.error_type = error_type
        self.context = context
        self.timestamp = datetime.utcnow().isoformat()
        super().__init__(message)

class CloudProcessingManager:
    """Manages cloud-based video processing with minimal overhead"""
    
    def __init__(self):
        """Initialize AWS clients and processing components"""
        self.region = os.getenv('AWS_REGION', 'us-west-2')
        self.bucket = os.getenv('S3_BUCKET', 'mam-video-processing')
        self.webhook_url = os.getenv('WEBHOOK_URL', 'http://localhost:5001/api/v1/webhooks/processing')
        
        # Initialize AWS clients with error handling
        try:
            self.s3 = boto3.client('s3', region_name=self.region)
            self.lambda_client = boto3.client('lambda', region_name=self.region)
            
            # Validate AWS credentials
            self.s3.list_buckets()
            logger.info("AWS clients initialized successfully", 
                       region=self.region, 
                       bucket=self.bucket)
        except Exception as e:
            logger.error("Failed to initialize AWS clients", 
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
            self.sample_rate = int(os.getenv('SAMPLE_RATE', 1))
            self.batch_size = int(os.getenv('BATCH_SIZE', 50))
            
            if self.sample_rate < 1:
                raise ValueError("Sample rate must be at least 1")
            if self.batch_size < 1:
                raise ValueError("Batch size must be at least 1")
                
            logger.info("Processing settings loaded",
                       max_file_size=self.max_file_size,
                       sample_rate=self.sample_rate,
                       batch_size=self.batch_size)
        except ValueError as e:
            logger.error("Invalid processing settings",
                        error=str(e))
            raise ProcessingError(
                message="Invalid processing settings",
                error_type="config_error",
                context={
                    "max_file_size": self.max_file_size,
                    "sample_rate": self.sample_rate,
                    "batch_size": self.batch_size
                }
            )
        
        # Initialize components with error tracking
        self.frame_extractor = FrameExtractor(sample_rate=self.sample_rate)
        self.processing_errors: List[Dict[str, Any]] = []
        self.processing_metrics: Dict[str, Any] = {
            "start_time": None,
            "frames_processed": 0,
            "batches_uploaded": 0,
            "errors_count": 0,
            "retries_count": 0
        }
    
    async def upload_frames_batch(self, frames: List[Dict], asset_id: str, batch_num: int) -> str:
        """
        Upload a batch of frames to S3 with enhanced error handling
        Args:
            frames: List of frame data dictionaries
            asset_id: Asset identifier
            batch_num: Batch number for this upload
        Returns:
            S3 key for uploaded batch
        """
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
            
            # Track successful upload
            upload_time = time.time() - start_time
            logger.info("Batch upload successful",
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
            
            logger.error("S3 upload failed",
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
            logger.error("Unexpected error during upload",
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
        """
        Process a video file using cloud resources with comprehensive monitoring
        Args:
            file_path: Path to video file
            asset_id: Unique identifier for the asset
        Returns:
            Dict containing processing results and metrics
        """
        try:
            # Initialize processing session
            self.processing_metrics['start_time'] = datetime.utcnow().isoformat()
            logger.info("Starting video processing",
                       asset_id=asset_id,
                       file_path=file_path,
                       settings={
                           'sample_rate': self.sample_rate,
                           'batch_size': self.batch_size,
                           'max_file_size': self.max_file_size
                       })
            
            # Validate file size
            file_size = os.path.getsize(file_path)
            if file_size > self.max_file_size:
                raise ProcessingError(
                    message=f"File exceeds {self.max_file_size/1e6}MB limit",
                    error_type="file_size_error",
                    context={'file_size': file_size, 'max_size': self.max_file_size}
                )
            
            # Extract scenes for intelligent sampling
            try:
                scenes = await self.frame_extractor.extract_scenes(file_path)
                logger.info("Scene detection complete",
                           asset_id=asset_id,
                           scene_count=len(scenes))
            except Exception as e:
                logger.error("Scene detection failed",
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
                        progress = (total_frames / (len(scenes) * self.sample_rate)) * 100
                        logger.info("Processing progress",
                                  asset_id=asset_id,
                                  batch_num=batch_num,
                                  frames_processed=total_frames,
                                  progress=f"{progress:.1f}%")
                        
                except Exception as e:
                    logger.error("Frame processing error",
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
                'metrics': self.processing_metrics
            }
            
            logger.info("Processing complete",
                       asset_id=asset_id,
                       **final_results)
            
            return final_results
            
        except Exception as e:
            logger.error("Processing failed",
                        asset_id=asset_id,
                        error=str(e),
                        traceback=True)
            return {
                'status': 'error',
                'asset_id': asset_id,
                'error': str(e),
                'error_type': type(e).__name__,
                'errors': self.processing_errors
            }
    
    @staticmethod
    def is_enabled() -> bool:
        """Check if cloud processing is enabled"""
        return os.getenv('CLOUD_ENABLED', 'false').lower() == 'true' 