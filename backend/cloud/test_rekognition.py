"""
Test AWS Rekognition Integration
Simple test script to verify Rekognition functionality with a sample image
"""

import boto3
import os
from pathlib import Path
import logging
from PIL import Image
import io

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_rekognition():
    """Test Rekognition API with a sample frame"""
    try:
        # Initialize Rekognition client
        rekognition = boto3.client('rekognition')
        logger.info("Initialized Rekognition client")
        
        # Get first video file from media directory
        media_path = os.getenv('MEDIA_BASE_PATH', '/Users/rjpaganini/Library/CloudStorage/GoogleDrive-rjpaganini@gmail.com/My Drive/Business/Valen Media/valn.io/exploration/valn.io/Data/Raw_Videos')
        
        # Find first video file
        video_file = None
        for root, _, files in os.walk(media_path):
            for file in files:
                if file.lower().endswith(('.mp4', '.mov')):
                    video_file = os.path.join(root, file)
                    break
            if video_file:
                break
                
        if not video_file:
            logger.error("No test video found")
            return
            
        logger.info(f"Using test video: {os.path.basename(video_file)}")
        
        # Extract a frame using OpenCV
        import cv2
        cap = cv2.VideoCapture(video_file)
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            logger.error("Failed to extract frame")
            return
            
        # Convert frame to bytes
        success, buffer = cv2.imencode('.jpg', frame)
        if not success:
            logger.error("Failed to encode frame")
            return
            
        frame_bytes = buffer.tobytes()
        
        # Test label detection
        logger.info("Testing label detection...")
        label_response = rekognition.detect_labels(
            Image={'Bytes': frame_bytes},
            MaxLabels=10,
            MinConfidence=70
        )
        
        logger.info("\nDetected Labels:")
        for label in label_response['Labels']:
            logger.info(f"- {label['Name']} ({label['Confidence']:.1f}% confidence)")
            if label.get('Parents'):
                logger.info(f"  Parents: {[p['Name'] for p in label['Parents']]}")
        
        # Test face detection
        logger.info("\nTesting face detection...")
        face_response = rekognition.detect_faces(
            Image={'Bytes': frame_bytes},
            Attributes=['ALL']
        )
        
        logger.info(f"\nDetected {len(face_response['FaceDetails'])} faces:")
        for i, face in enumerate(face_response['FaceDetails'], 1):
            logger.info(f"\nFace {i}:")
            logger.info(f"- Confidence: {face['Confidence']:.1f}%")
            logger.info(f"- Gender: {face['Gender']['Value']}")
            logger.info(f"- Age Range: {face['AgeRange']['Low']}-{face['AgeRange']['High']} years")
            logger.info(f"- Top Emotion: {sorted(face['Emotions'], key=lambda x: x['Confidence'], reverse=True)[0]['Type']}")
        
        # Test text detection
        logger.info("\nTesting text detection...")
        text_response = rekognition.detect_text(
            Image={'Bytes': frame_bytes}
        )
        
        logger.info("\nDetected Text:")
        for text in text_response['TextDetections']:
            if text['Type'] == 'LINE':
                logger.info(f"- {text['DetectedText']} ({text['Confidence']:.1f}% confidence)")
        
        logger.info("\nRekognition test completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"Test failed: {str(e)}")
        return False

if __name__ == '__main__':
    logger.info("Starting Rekognition test...")
    test_rekognition() 