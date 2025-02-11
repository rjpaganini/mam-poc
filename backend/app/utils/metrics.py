"""
backend/app/utils/metrics.py
==========================================
Performance Metrics Collection System
==========================================

Implements a lightweight metrics collection system using decorators.
Tracks key performance indicators without impacting system performance.

Features:
- Request timing with percentiles
- Memory usage tracking
- Asset access patterns
- AI processing performance
- Cache hit ratios

Author: Senior Developer
Date: 2024
"""

import time
import functools
import statistics
from typing import Dict, List, Any
from collections import defaultdict
import threading
import psutil
from datetime import datetime

class MetricsCollector:
    """Thread-safe metrics collection singleton"""
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._init_metrics()
            return cls._instance
    
    def _init_metrics(self):
        """Initialize metrics storage"""
        self.metrics = {
            'requests': defaultdict(list),      # Request timing by endpoint
            'processing': defaultdict(list),    # AI processing times
            'memory': [],                       # Memory snapshots
            'cache': {                          # Cache performance
                'hits': 0,
                'misses': 0
            },
            'errors': defaultdict(int)          # Error counts by type
        }
        
    def record_request(self, endpoint: str, duration: float):
        """Record API request duration"""
        with self._lock:
            self.metrics['requests'][endpoint].append({
                'duration': duration,
                'timestamp': datetime.utcnow().isoformat()
            })
            
    def record_processing(self, asset_id: int, processor: str, duration: float):
        """Record AI processing duration"""
        with self._lock:
            self.metrics['processing'][processor].append({
                'asset_id': asset_id,
                'duration': duration,
                'timestamp': datetime.utcnow().isoformat()
            })
            
    def record_memory(self):
        """Record current memory usage"""
        with self._lock:
            process = psutil.Process()
            self.metrics['memory'].append({
                'usage': process.memory_info().rss,
                'timestamp': datetime.utcnow().isoformat()
            })
            
    def record_cache(self, hit: bool):
        """Record cache hit/miss"""
        with self._lock:
            if hit:
                self.metrics['cache']['hits'] += 1
            else:
                self.metrics['cache']['misses'] += 1
                
    def record_error(self, error_type: str):
        """Record error occurrence"""
        with self._lock:
            self.metrics['errors'][error_type] += 1
            
    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics with analysis"""
        with self._lock:
            metrics = {
                'requests': {},
                'processing': {},
                'memory': {},
                'cache': {},
                'errors': dict(self.metrics['errors'])
            }
            
            # Analyze request metrics
            for endpoint, timings in self.metrics['requests'].items():
                durations = [t['duration'] for t in timings[-100:]]  # Last 100 requests
                if durations:
                    metrics['requests'][endpoint] = {
                        'avg': statistics.mean(durations),
                        'p95': statistics.quantiles(durations, n=20)[18],  # 95th percentile
                        'count': len(timings)
                    }
                    
            # Analyze processing metrics
            for processor, timings in self.metrics['processing'].items():
                durations = [t['duration'] for t in timings[-50:]]  # Last 50 processes
                if durations:
                    metrics['processing'][processor] = {
                        'avg': statistics.mean(durations),
                        'p95': statistics.quantiles(durations, n=20)[18],
                        'count': len(timings)
                    }
                    
            # Analyze memory metrics
            if self.metrics['memory']:
                recent_memory = [m['usage'] for m in self.metrics['memory'][-60:]]  # Last 60 snapshots
                metrics['memory'] = {
                    'current': recent_memory[-1] if recent_memory else 0,
                    'avg': statistics.mean(recent_memory) if recent_memory else 0,
                    'peak': max(recent_memory) if recent_memory else 0
                }
                
            # Calculate cache hit ratio
            total_cache = self.metrics['cache']['hits'] + self.metrics['cache']['misses']
            metrics['cache'] = {
                'hit_ratio': self.metrics['cache']['hits'] / total_cache if total_cache > 0 else 0,
                'total_requests': total_cache
            }
            
            return metrics

# Create singleton instance
metrics = MetricsCollector()

def track_performance(endpoint: str = None):
    """
    Decorator to track endpoint performance
    
    Usage:
    @track_performance('asset_retrieval')
    def get_asset(asset_id):
        ...
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.perf_counter()
            try:
                result = func(*args, **kwargs)
                duration = time.perf_counter() - start_time
                metrics.record_request(endpoint or func.__name__, duration)
                return result
            except Exception as e:
                metrics.record_error(type(e).__name__)
                raise
        return wrapper
    return decorator

def track_processing(processor: str):
    """
    Decorator to track AI processing performance
    
    Usage:
    @track_processing('scene_detection')
    async def process_scene(asset_id):
        ...
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(asset_id, *args, **kwargs):
            start_time = time.perf_counter()
            try:
                result = await func(asset_id, *args, **kwargs)
                duration = time.perf_counter() - start_time
                metrics.record_processing(asset_id, processor, duration)
                return result
            except Exception as e:
                metrics.record_error(f"{processor}_{type(e).__name__}")
                raise
        return wrapper
    return decorator 