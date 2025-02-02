# file_utils.py - Provides file streaming utilities for media files.
# Purpose: Contains functions for reading entire files and partial file streaming to support media delivery.

# The file_reader function opens a file in binary mode and returns its full content.
# The partial_file_reader function reads a specific chunk of the file based on start and end positions.

"""
Utility functions for file operations, particularly for handling media file streaming.
"""

def file_reader(file_path: str):
    """
    Generator function to read a file in chunks.
    
    Args:
        file_path (str): Path to the file to read
        
    Yields:
        bytes: Chunks of the file
    """
    chunk_size = 8192  # 8KB chunks
    with open(file_path, 'rb') as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            yield chunk

def partial_file_reader(file_path: str, start_byte: int, length: int):
    """
    Generator function to read a portion of a file in chunks.
    Used for range requests when streaming media.
    
    Args:
        file_path (str): Path to the file to read
        start_byte (int): Starting byte position
        length (int): Number of bytes to read
        
    Yields:
        bytes: Chunks of the file
    """
    chunk_size = 8192  # 8KB chunks
    remaining = length
    
    with open(file_path, 'rb') as f:
        f.seek(start_byte)
        while remaining > 0:
            chunk_size = min(chunk_size, remaining)
            chunk = f.read(chunk_size)
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk 