"""
Cloud Processing Package for MAM System
=====================================

This package provides cloud-based video processing capabilities using AWS services.
"""

from .processing_manager import CloudProcessingManager
from .frame_extractor import FrameExtractor

__all__ = ['CloudProcessingManager', 'FrameExtractor'] 