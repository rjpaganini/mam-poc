"""
backend/app/ai/processors/logo_processor.py

This module implements logo detection for commercial video assets.
It uses OpenCV to detect and track potential logo regions in video frames,
optimized for commercial content and M-series Mac performance.

Key Features:
- Efficient logo region detection
- Frame sampling for performance
- Logo presence tracking
- Logo position analysis
- Memory-efficient processing

Dependencies:
- opencv-python
- numpy

Author: AI Assistant
Date: February 2024
"""

import cv2
import numpy as np
from typing import Dict, Any, List, Tuple
import logging
from pathlib import Path

from .base_processor import BaseProcessor

class LogoProcessor(BaseProcessor):
    """
    Processor for detecting and tracking logos in commercial videos.
    
    This processor uses computer vision techniques to identify potential
    logo regions in video frames. It's optimized for commercial content
    where logos typically appear in corners or center screen.
    
    Attributes:
        sample_rate (float): Frame sampling rate (default: 1.0 fps)
        min_logo_size (int): Minimum logo area in pixels (default: 500)
        max_logo_size (int): Maximum logo area in pixels (default: 50000)
        confidence_threshold (float): Minimum confidence for logo detection
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the logo detection processor.
        
        Args:
            config (Dict[str, Any], optional): Configuration parameters
                - sample_rate: Frames per second to analyze
                - min_logo_size: Minimum logo area in pixels
                - max_logo_size: Maximum logo area in pixels
                - confidence_threshold: Minimum detection confidence
        """
        super().__init__("LogoProcessor", config)
        
        # Set default configuration
        self.sample_rate = self.config.get('sample_rate', 1.0)
        self.min_logo_size = self.config.get('min_logo_size', 500)
        self.max_logo_size = self.config.get('max_logo_size', 50000)
        self.confidence_threshold = self.config.get('confidence_threshold', 0.5)
        
        self.logger.info(
            f"Initialized LogoProcessor with sample_rate={self.sample_rate}fps, "
            f"size_range={self.min_logo_size}-{self.max_logo_size}px"
        )
    
    async def process(self, file_path: str) -> Dict[str, Any]:
        """
        Process a video file to detect and track logos.
        
        Args:
            file_path (str): Path to the video file
            
        Returns:
            Dict[str, Any]: Logo analysis results including:
                - total_logos_detected: Number of unique logo regions
                - logo_appearances: List of logo timestamps and positions
                - coverage_percentage: Percentage of video with logos
                - common_positions: Most frequent logo positions
        """
        try:
            self.validate_input(file_path)
            self.logger.info(f"Starting logo detection for: {file_path}")
            
            # Open video file
            cap = cv2.VideoCapture(file_path)
            if not cap.isOpened():
                raise RuntimeError(f"Failed to open video file: {file_path}")
            
            # Get video properties
            fps = cap.get(cv2.CAP_PROP_FPS)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            duration = total_frames / fps
            
            # Calculate frame sampling
            frame_interval = int(fps / self.sample_rate)
            logo_data = []
            
            try:
                frame_count = 0
                while cap.isOpened():
                    # Sample frames at specified rate
                    if frame_count % frame_interval != 0:
                        cap.grab()  # Skip frame but keep counting
                        frame_count += 1
                        continue
                    
                    ret, frame = cap.read()
                    if not ret:
                        break
                    
                    # Process frame for logo detection
                    frame_logos = self._detect_logos_in_frame(
                        frame, 
                        timestamp=frame_count/fps
                    )
                    logo_data.extend(frame_logos)
                    
                    frame_count += 1
                    
            finally:
                cap.release()
            
            # Analyze logo data
            analysis_results = self._analyze_logo_data(logo_data, duration)
            
            self.logger.info(
                f"Completed logo detection for {file_path}: "
                f"found {len(logo_data)} potential logos"
            )
            
            return analysis_results
            
        except Exception as e:
            self.logger.error(f"Logo detection failed for {file_path}: {str(e)}")
            raise RuntimeError(f"Logo detection failed: {str(e)}")
    
    def _detect_logos_in_frame(
        self, 
        frame: np.ndarray, 
        timestamp: float
    ) -> List[Dict[str, Any]]:
        """
        Detect potential logo regions in a single frame.
        
        Args:
            frame (np.ndarray): Video frame as numpy array
            timestamp (float): Frame timestamp in seconds
            
        Returns:
            List[Dict[str, Any]]: Detected logo regions with positions
        """
        # Convert to grayscale for processing
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Apply adaptive thresholding
        thresh = cv2.adaptiveThreshold(
            gray, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, 11, 2
        )
        
        # Find contours of potential logo regions
        contours, _ = cv2.findContours(
            thresh,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE
        )
        
        frame_logos = []
        for contour in contours:
            area = cv2.contourArea(contour)
            
            # Filter by size
            if self.min_logo_size <= area <= self.max_logo_size:
                x, y, w, h = cv2.boundingRect(contour)
                aspect_ratio = float(w)/h
                
                # Filter by shape (most logos are roughly square-ish)
                if 0.5 <= aspect_ratio <= 2.0:
                    confidence = min(area/self.max_logo_size, 1.0)
                    
                    if confidence >= self.confidence_threshold:
                        frame_logos.append({
                            'timestamp': timestamp,
                            'position': {
                                'x': int(x),
                                'y': int(y),
                                'width': int(w),
                                'height': int(h)
                            },
                            'confidence': float(confidence),
                            'area': float(area)
                        })
        
        return frame_logos
    
    def _analyze_logo_data(
        self, 
        logo_data: List[Dict[str, Any]], 
        video_duration: float
    ) -> Dict[str, Any]:
        """
        Analyze collected logo detection data.
        
        Args:
            logo_data (List[Dict[str, Any]]): Collected logo detections
            video_duration (float): Total video duration in seconds
            
        Returns:
            Dict[str, Any]: Analysis results and statistics
        """
        if not logo_data:
            return {
                'total_logos_detected': 0,
                'logo_appearances': [],
                'coverage_percentage': 0.0,
                'common_positions': []
            }
        
        # Calculate coverage
        unique_timestamps = len(set(logo['timestamp'] for logo in logo_data))
        coverage = (unique_timestamps * (1.0/self.sample_rate)) / video_duration
        
        # Find common positions
        positions = []
        for logo in logo_data:
            pos = logo['position']
            center_x = pos['x'] + pos['width']/2
            center_y = pos['y'] + pos['height']/2
            positions.append((center_x, center_y))
        
        positions = np.array(positions)
        
        return {
            'total_logos_detected': len(logo_data),
            'logo_appearances': logo_data,
            'coverage_percentage': float(coverage * 100),
            'processing_stats': {
                'sample_rate_used': self.sample_rate,
                'confidence_threshold': self.confidence_threshold
            }
        }
    
    def update_config(self, new_config: Dict[str, Any]) -> None:
        """
        Update processor configuration.
        
        Args:
            new_config (Dict[str, Any]): New configuration parameters
        """
        super().update_config(new_config)
        
        # Update instance variables
        if 'sample_rate' in new_config:
            self.sample_rate = new_config['sample_rate']
        if 'min_logo_size' in new_config:
            self.min_logo_size = new_config['min_logo_size']
        if 'max_logo_size' in new_config:
            self.max_logo_size = new_config['max_logo_size']
        if 'confidence_threshold' in new_config:
            self.confidence_threshold = new_config['confidence_threshold'] 