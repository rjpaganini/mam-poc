"""
AWS Lambda function for processing video frames with Rekognition.
Processes frames uploaded to S3 and stores results.
"""

import json
import boto3
import os
import logging
from typing import Dict, Any
import urllib.parse

# Initialize AWS clients
s3 = boto3.client('s3')
rekognition = boto3.client('rekognition')
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def process_frame(frame_bytes: bytes) -> Dict[str, Any]:
    """Process a single frame with Rekognition"""
    try:
        # Detect labels
        label_response = rekognition.detect_labels(
            Image={'Bytes': frame_bytes},
            MaxLabels=10,
            MinConfidence=70
        )
        
        # Detect faces
        face_response = rekognition.detect_faces(
            Image={'Bytes': frame_bytes},
            Attributes=['ALL']
        )
        
        # Detect text
        text_response = rekognition.detect_text(
            Image={'Bytes': frame_bytes}
        )
        
        return {
            'labels': label_response['Labels'],
            'faces': face_response['FaceDetails'],
            'texts': text_response['TextDetections']
        }
    except Exception as e:
        logger.error(f"Frame processing error: {str(e)}")
        raise

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda handler for processing frames"""
    try:
        # Get bucket and key from event
        bucket = event['Records'][0]['s3']['bucket']['name']
        key = urllib.parse.unquote_plus(event['Records'][0]['s3']['object']['key'])
        
        logger.info(f"Processing frames from s3://{bucket}/{key}")
        
        # Get frames batch from S3
        response = s3.get_object(Bucket=bucket, Key=key)
        frames_batch = json.loads(response['Body'].read())
        
        # Process each frame
        results = []
        for frame_data in frames_batch:
            # Convert frame back to bytes
            frame_bytes = frame_data['frame'].encode('latin1')
            
            # Process frame with Rekognition
            frame_results = process_frame(frame_bytes)
            
            # Add metadata
            results.append({
                'timestamp': frame_data['metadata']['timestamp'],
                'scene_id': frame_data['metadata']['scene_id'],
                'results': frame_results
            })
        
        # Store results in S3
        result_key = key.replace('frames/', 'results/')
        s3.put_object(
            Bucket=bucket,
            Key=result_key,
            Body=json.dumps(results),
            ContentType='application/json'
        )
        
        logger.info(f"Successfully processed {len(results)} frames")
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Processed {len(results)} frames',
                'result_key': result_key
            })
        }
        
    except Exception as e:
        logger.error(f"Processing failed: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        } 