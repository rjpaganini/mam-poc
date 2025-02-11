"""
backend/app/ai/processors/scene_processor.py

This module implements scene detection for commercial video assets.
It uses PySceneDetect to identify scene changes and transitions in commercials,
optimized for short-form content like 30/60 second spots.

Key Features:
- Commercial-optimized scene detection
- Configurable detection thresholds
- Scene boundary identification
- Scene duration analysis
- Memory-efficient chunk processing
- M1/M2 Mac optimization

Dependencies:
- scenedetect
- numpy
- opencv-python

Author: AI Assistant
Date: February 2024
"""

import numpy as np
from scenedetect import detect, ContentDetector
from typing import Dict, Any, List, Tuple
import logging
from pathlib import Path
import cv2

from .base_processor import BaseProcessor

class SceneProcessor(BaseProcessor):
    """
    Processor for detecting and analyzing scenes in commercial videos.
    
    This processor is optimized for short-form content, particularly
    30 and 60 second commercials. It uses content-aware scene detection
    with parameters tuned for commercial-style editing.
    
    Attributes:
        threshold (float): Detection threshold (default: 27.0)
        min_scene_length (float): Minimum scene length in seconds (default: 0.5)
        max_scenes (int): Maximum number of scenes to detect (default: 30)
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the scene detection processor.
        
        Args:
            config (Dict[str, Any], optional): Configuration parameters
                - threshold: Detection sensitivity (20-30 recommended)
                - min_scene_length: Minimum scene duration in seconds
                - max_scenes: Maximum number of scenes to detect
        """
        super().__init__("SceneProcessor", config)
        
        # Set default configuration
        self.threshold = self.config.get('threshold', 27.0)
        self.min_scene_length = self.config.get('min_scene_length', 0.5)
        self.max_scenes = self.config.get('max_scenes', 30)
        
        self.logger.info(
            f"Initialized SceneProcessor with threshold={self.threshold}, "
            f"min_scene_length={self.min_scene_length}s"
        )
    
    async def process(
        self, 
        file_path: str,
        chunk_size: int = 10 * 1024 * 1024
    ) -> Dict[str, Any]:
        """Process video in memory-efficient chunks"""
        try:
            self.validate_input(file_path)
            self.logger.info(f"Starting scene detection for: {file_path}")
            
            # Open video with chunk-based reading
            cap = cv2.VideoCapture(file_path)
            if not cap.isOpened():
                raise RuntimeError(f"Failed to open video: {file_path}")
            
            # Get video properties
            fps = cap.get(cv2.CAP_PROP_FPS)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            duration = total_frames / fps
            
            # Calculate frames per chunk based on chunk_size
            bytes_per_frame = (
                cap.get(cv2.CAP_PROP_FRAME_WIDTH) * 
                cap.get(cv2.CAP_PROP_FRAME_HEIGHT) * 
                3  # BGR channels
            )
            frames_per_chunk = max(1, int(chunk_size / bytes_per_frame))
            
            scenes = []
            frame_count = 0
            last_frame = None
            
            try:
                while frame_count < total_frames:
                    # Process frames in chunks
                    chunk_frames = []
                    for _ in range(frames_per_chunk):
                        ret, frame = cap.read()
                        if not ret:
                            break
                        
                        # Convert to grayscale for efficiency
                        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                        chunk_frames.append(gray)
                        frame_count += 1
                    
                    if not chunk_frames:
                        break
                    
                    # Detect scenes in this chunk
                    for i, frame in enumerate(chunk_frames):
                        if last_frame is not None:
                            # Calculate frame difference
                            diff = cv2.absdiff(last_frame, frame)
                            mean_diff = np.mean(diff)
                            
                            # Check for scene change
                            if mean_diff > self.threshold:
                                timestamp = (frame_count - len(chunk_frames) + i) / fps
                                if not scenes or timestamp - scenes[-1] >= self.min_scene_length:
                                    scenes.append(timestamp)
                        
                        last_frame = frame
                    
                    # Stop if we've found enough scenes
                    if len(scenes) >= self.max_scenes:
                        break
                    
            finally:
                cap.release()
            
            # Analyze scene data
            scene_data = {
                'total_scenes': len(scenes),
                'scenes': [
                    {
                        'start': scenes[i],
                        'end': scenes[i + 1] if i < len(scenes) - 1 else duration,
                        'duration': scenes[i + 1] - scenes[i] if i < len(scenes) - 1 else duration - scenes[i]
                    }
                    for i in range(len(scenes))
                ],
                'average_scene_length': np.mean([
                    s['duration'] for s in scenes
                ]) if scenes else duration,
                'total_duration': duration
            }
            
            self.logger.info(
                f"Completed scene detection for {file_path}: "
                f"found {len(scenes)} scenes"
            )
            
            return scene_data
            
        except Exception as e:
            self.logger.error(f"Scene detection failed: {str(e)}")
            raise RuntimeError(f"Scene detection failed: {str(e)}")
    
    def update_config(self, new_config: Dict[str, Any]) -> None:
        """
        Update processor configuration.
        
        Args:
            new_config (Dict[str, Any]): New configuration parameters
        """
        super().update_config(new_config)
        
        # Update instance variables
        if 'threshold' in new_config:
            self.threshold = new_config['threshold']
        if 'min_scene_length' in new_config:
            self.min_scene_length = new_config['min_scene_length']
        if 'max_scenes' in new_config:
            self.max_scenes = new_config['max_scenes'] 