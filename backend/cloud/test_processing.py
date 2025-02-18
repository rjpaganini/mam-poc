"""
Test Script for Cloud Processing
Validates AWS connectivity and processing pipeline
Author: Senior Developer
Date: 2024
"""

import asyncio
from cloud.processing_manager import CloudProcessingManager
import os
import boto3

async def test_cloud_processing():
    """Test cloud processing with a sample video"""
    
    # Initialize cloud manager
    manager = CloudProcessingManager()
    
    # Verify cloud processing is enabled
    if not manager.is_enabled():
        print("❌ Cloud processing is disabled")
        return
        
    print("✅ Cloud processing is enabled")
    print(f"✅ Using AWS region: {manager.region}")
    
    # Test AWS connectivity with STS instead of S3
    try:
        sts = boto3.client('sts', region_name=manager.region)
        identity = sts.get_caller_identity()
        print(f"✅ AWS credentials are valid (Account: {identity['Account']})")
    except Exception as e:
        print(f"❌ AWS credentials error: {e}")
        return
    
    # Get first video file from media directory for testing
    media_path = os.getenv('MEDIA_BASE_PATH', '/Users/rjpaganini/Library/CloudStorage/GoogleDrive-rjpaganini@gmail.com/My Drive/Business/Valen Media/valn.io/exploration/valn.io/Data/Raw_Videos')
    test_video = None
    
    for root, _, files in os.walk(media_path):
        for file in files:
            if file.lower().endswith(('.mp4', '.mov', '.avi')):
                test_video = os.path.join(root, file)
                break
        if test_video:
            break
    
    if not test_video:
        print("❌ No test video found")
        return
        
    print(f"✅ Found test video: {os.path.basename(test_video)}")
    
    # Test processing
    result = await manager.process_video(test_video, 'test-001')
    print(f"✅ Processing result: {result}")

if __name__ == '__main__':
    asyncio.run(test_cloud_processing()) 