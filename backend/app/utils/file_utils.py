# file_utils.py - Provides file streaming utilities for media files.
# Purpose: Contains functions for reading entire files and partial file streaming to support media delivery.

# The file_reader function opens a file in binary mode and returns its full content.
# The partial_file_reader function reads a specific chunk of the file based on start and end positions.

"""
Utility functions for file operations, particularly for handling media file streaming.
"""
import os
import fcntl
from typing import Generator

def file_reader(file_path: str) -> Generator[bytes, None, None]:
    """
    Generator function to read a file in chunks with proper locking.
    
    Args:
        file_path (str): Path to the file to read
        
    Yields:
        bytes: Chunks of the file
    """
    chunk_size = 1024 * 1024  # 1MB chunks for video streaming
    try:
        with open(file_path, 'rb') as f:
            # Get an exclusive lock
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                yield chunk
            # Release the lock
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    except IOError as e:
        raise IOError(f"Error reading file {file_path}: {str(e)}")

def partial_file_reader(file_path: str, start_byte: int, length: int) -> Generator[bytes, None, None]:
    """
    Generator function to read a portion of a file in chunks with proper locking.
    Used for range requests when streaming media.
    
    Args:
        file_path (str): Path to the file to read
        start_byte (int): Starting byte position
        length (int): Number of bytes to read
        
    Yields:
        bytes: Chunks of the file
    """
    chunk_size = 1024 * 1024  # 1MB chunks for video streaming
    remaining = length
    
    try:
        with open(file_path, 'rb') as f:
            # Get an exclusive lock
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            f.seek(start_byte)
            while remaining > 0:
                current_chunk_size = min(chunk_size, remaining)
                chunk = f.read(current_chunk_size)
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk
            # Release the lock
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    except IOError as e:
        raise IOError(f"Error reading file {file_path}: {str(e)}") 