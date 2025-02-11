"""
backend/app/utils/caching.py
==========================================
Asset Caching System
==========================================

Implements an intelligent caching system for media assets
with LRU eviction and automatic invalidation.

Features:
- Memory-efficient caching
- LRU eviction policy
- Automatic cache invalidation
- Cache warming for frequent assets
- Hit ratio monitoring

Author: Senior Developer
Date: 2024
"""

import time
from typing import Dict, Any, Optional, Callable
from collections import OrderedDict
import threading
import logging
from functools import wraps
import asyncio
from .metrics import metrics

logger = logging.getLogger(__name__)

class LRUCache:
    """Thread-safe LRU cache implementation"""
    
    def __init__(self, max_size: int = 100, ttl: int = 3600):
        """
        Initialize cache
        
        Args:
            max_size: Maximum number of items to cache
            ttl: Time to live in seconds
        """
        self._cache: OrderedDict = OrderedDict()
        self._max_size = max_size
        self._ttl = ttl
        self._lock = threading.Lock()
        
    def get(self, key: str) -> Optional[Any]:
        """Get item from cache"""
        with self._lock:
            if key not in self._cache:
                metrics.record_cache(hit=False)
                return None
                
            item = self._cache[key]
            if time.time() - item['timestamp'] > self._ttl:
                del self._cache[key]
                metrics.record_cache(hit=False)
                return None
                
            # Move to end (most recently used)
            self._cache.move_to_end(key)
            metrics.record_cache(hit=True)
            return item['value']
            
    def set(self, key: str, value: Any):
        """Add item to cache"""
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
            self._cache[key] = {
                'value': value,
                'timestamp': time.time()
            }
            
            # Evict oldest if over size
            while len(self._cache) > self._max_size:
                self._cache.popitem(last=False)
                
    def invalidate(self, key: str):
        """Remove item from cache"""
        with self._lock:
            self._cache.pop(key, None)
            
    def clear(self):
        """Clear entire cache"""
        with self._lock:
            self._cache.clear()
            
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self._lock:
            return {
                'size': len(self._cache),
                'max_size': self._max_size,
                'keys': list(self._cache.keys())
            }

# Create cache instances
metadata_cache = LRUCache(max_size=1000)  # Metadata cache
thumbnail_cache = LRUCache(max_size=500)  # Thumbnail cache
content_cache = LRUCache(max_size=50)     # Full content cache (limited size)

def cache_result(cache: LRUCache, key_prefix: str = ''):
    """
    Decorator to cache function results
    
    Usage:
    @cache_result(metadata_cache, 'asset_meta_')
    async def get_asset_metadata(asset_id):
        ...
    """
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            # Generate cache key
            key = f"{key_prefix}{':'.join(str(arg) for arg in args)}"
            
            # Check cache
            result = cache.get(key)
            if result is not None:
                return result
                
            # Get fresh result
            result = await func(*args, **kwargs)
            cache.set(key, result)
            return result
            
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            # Generate cache key
            key = f"{key_prefix}{':'.join(str(arg) for arg in args)}"
            
            # Check cache
            result = cache.get(key)
            if result is not None:
                return result
                
            # Get fresh result
            result = func(*args, **kwargs)
            cache.set(key, result)
            return result
            
        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
    return decorator

def invalidate_cache(cache: LRUCache, key_prefix: str = ''):
    """
    Decorator to invalidate cache after function execution
    
    Usage:
    @invalidate_cache(metadata_cache, 'asset_meta_')
    async def update_asset_metadata(asset_id):
        ...
    """
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            result = await func(*args, **kwargs)
            key = f"{key_prefix}{':'.join(str(arg) for arg in args)}"
            cache.invalidate(key)
            return result
            
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            result = func(*args, **kwargs)
            key = f"{key_prefix}{':'.join(str(arg) for arg in args)}"
            cache.invalidate(key)
            return result
            
        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
    return decorator 