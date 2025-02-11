"""
backend/cloud/frame_extractor.py
==========================================
Frame Extraction Module for Cloud Processing
==========================================

This module handles intelligent frame extraction from videos using OpenCV and PySceneDetect.
It implements a hybrid approach:
1. Content-aware scene detection for major changes
2. Intelligent frame sampling within scenes
3. Metadata extraction for each frame

Key Features:
- Adaptive frame sampling based on scene complexity
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
from typing import Generator, Dict, Any
import asyncio
import logging
from datetime import timedelta

class FrameExtractor:
    """
    Intelligent frame extraction with scene detection.
    Optimizes cloud processing by selecting the most relevant frames.
    """
    
    def __init__(self, sample_rate: int = 1):
        """
        Initialize frame extractor with configurable sampling.
        Args:
            sample_rate: Frames per second to extract (default: 1)
        """
        self.sample_rate = sample_rate
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
    
    async def extract_frames(self, video_path: str) -> Generator[Dict[str, Any], None, None]:
        """
        Extract frames with rich metadata using hybrid approach.
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
            
            # Detect scenes for intelligent sampling
            scenes = await self.extract_scenes(video_path)
            
            for scene_start, scene_end in scenes:
                # Calculate frames to sample in this scene
                scene_duration = scene_end - scene_start
                frames_to_sample = int(scene_duration * self.sample_rate)
                
                # Position capture at scene start
                start_frame = int(scene_start * fps)
                cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
                
                # Extract frames from scene
                for _ in range(frames_to_sample):
                    ret, frame = cap.read()
                    if not ret:
                        break
                        
                    # Get current frame metadata
                    frame_time = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
                    
                    # Extract frame metadata
                    metadata = {
                        'timestamp': frame_time,
                        'scene_id': scenes.index((scene_start, scene_end)),
                        'frame_type': 'scene_change' if abs(frame_time - scene_start) < 0.1 else 'content',
                        'resolution': (frame.shape[1], frame.shape[0]),
                        'scene_progress': (frame_time - scene_start) / scene_duration
                    }
                    
                    yield {
                        'frame': frame,
                        'metadata': metadata
                    }
                    
                    # Calculate next frame position
                    next_pos = cap.get(cv2.CAP_PROP_POS_FRAMES) + (fps / self.sample_rate)
                    cap.set(cv2.CAP_PROP_POS_FRAMES, next_pos)
                    
                    # Allow other tasks to run
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