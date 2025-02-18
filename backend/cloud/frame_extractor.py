"""
backend/cloud/frame_extractor.py
==========================================
Frame Extraction Module for Cloud Processing
==========================================

This module handles intelligent frame extraction from videos using OpenCV and PySceneDetect.
It implements a comprehensive approach:
1. Content-aware scene detection for major changes
2. Full frame extraction (no sampling)
3. Rich metadata extraction per frame

Key Features:
- Complete frame processing without sampling
- Memory-efficient processing using generators
- Rich metadata extraction per frame
- Progress tracking and async support

Author: Senior Developer
Date: February 2024
"""

import cv2
import numpy as np
from scenedetect import detect, ContentDetector
from pathlib import Path
from typing import Generator, Dict, Any, AsyncGenerator
import asyncio
import logging
from datetime import timedelta

class FrameExtractor:
    """
    Complete frame extraction with scene detection.
    Processes every frame for maximum accuracy.
    """
    
    def __init__(self, sample_rate: int = 30):
        """
        Initialize frame extractor.
        Args:
            sample_rate: Default FPS, not used for sampling anymore
        """
        self.logger = logging.getLogger(__name__)
    
    async def extract_scenes(self, video_path: str) -> list:
        """
        Detect scene boundaries using content-aware detection.
        Args:
            video_path: Path to video file
        Returns:
            List of scene timestamps (start, end) in seconds
        """
        try:
            # Use PySceneDetect for accurate scene detection
            scenes = detect(video_path, ContentDetector())
            return [(scene[0].get_seconds(), scene[1].get_seconds()) 
                    for scene in scenes]
        except Exception as e:
            self.logger.error(f"Scene detection failed: {e}")
            # Fallback to single scene if detection fails
            cap = cv2.VideoCapture(video_path)
            duration = cap.get(cv2.CAP_PROP_FRAME_COUNT) / cap.get(cv2.CAP_PROP_FPS)
            cap.release()
            return [(0, duration)]
    
    async def extract_frames(self, video_path: str) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Extract ALL frames with rich metadata.
        Args:
            video_path: Path to video file
        Yields:
            Dict containing frame data and metadata
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Failed to open video: {video_path}")
            
        try:
            # Get video properties
            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            duration = frame_count / fps
            
            # Log video stats
            self.logger.info(f"Processing video: {fps} fps, {frame_count} frames, {duration:.2f} seconds")
            
            # Detect scenes for metadata
            scenes = await self.extract_scenes(video_path)
            current_scene = 0
            next_scene_start = scenes[1][0] if len(scenes) > 1 else duration
            
            # Process every single frame
            frame_number = 0
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                    
                # Get current frame time
                frame_time = frame_number / fps
                
                # Update current scene if needed
                while frame_time >= next_scene_start and current_scene < len(scenes) - 1:
                    current_scene += 1
                    next_scene_start = scenes[current_scene + 1][0] if current_scene < len(scenes) - 1 else duration
                
                # Extract frame metadata
                scene_start, scene_end = scenes[current_scene]
                metadata = {
                    'timestamp': frame_time,
                    'frame_number': frame_number,
                    'scene_id': current_scene,
                    'frame_type': 'scene_change' if abs(frame_time - scene_start) < 1/fps else 'content',
                    'resolution': (frame.shape[1], frame.shape[0]),
                    'scene_progress': (frame_time - scene_start) / (scene_end - scene_start)
                }
                
                yield {
                    'frame': frame,
                    'metadata': metadata
                }
                
                frame_number += 1
                
                # Allow other tasks to run every 10 frames
                if frame_number % 10 == 0:
                    await asyncio.sleep(0)
                    
        finally:
            cap.release()
    
    @staticmethod
    def frame_to_bytes(frame: np.ndarray, quality: int = 90) -> bytes:
        """
        Convert frame to compressed JPEG bytes for cloud storage.
        Args:
            frame: NumPy array containing frame data
            quality: JPEG compression quality (1-100)
        Returns:
            Compressed frame as bytes
        """
        success, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
        if not success:
            raise ValueError("Failed to encode frame")
        return buffer.tobytes() 