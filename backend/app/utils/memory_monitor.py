"""
Memory monitoring utilities to prevent OOM killer termination.
"""
import os
import psutil
import threading
import logging
from typing import Optional, Dict, List
import atexit
from datetime import datetime
import time
from flask import Flask, current_app
from ..config import (
    MEMORY_WARNING_THRESHOLD,
    MEMORY_CRITICAL_THRESHOLD,
    MEMORY_CHECK_INTERVAL
)
import gc
import weakref

# Configure module-level logger
logger = logging.getLogger(__name__)

class MemoryStatus:
    """Memory status constants."""
    NORMAL = 'normal'
    WARNING = 'warning'
    CRITICAL = 'critical'
    ERROR = 'error'

class CleanupStrategy:
    """Memory cleanup strategy interface."""
    
    def __init__(self, name: str, threshold: float):
        self.name = name
        self.threshold = threshold
    
    def should_run(self, usage: Dict[str, float]) -> bool:
        """Check if strategy should run based on memory usage."""
        return usage['percent'] >= self.threshold
    
    def cleanup(self) -> None:
        """Perform cleanup action."""
        raise NotImplementedError

class GCStrategy(CleanupStrategy):
    """Garbage collection cleanup strategy."""
    
    def cleanup(self) -> None:
        """Run garbage collection."""
        gc.collect()
        logger.info(f"{self.name}: Garbage collection completed")

class CacheClearStrategy(CleanupStrategy):
    """Application cache clearing strategy."""
    
    def cleanup(self) -> None:
        """Clear application caches."""
        if current_app and hasattr(current_app, 'cache'):
            current_app.cache.clear()
            logger.info(f"{self.name}: Application cache cleared")

class EmergencyStrategy(CleanupStrategy):
    """Emergency cleanup strategy combining multiple approaches."""
    
    def cleanup(self) -> None:
        """Perform emergency cleanup."""
        # Run garbage collection with full generations
        gc.collect(2)
        
        # Clear application caches
        if current_app and hasattr(current_app, 'cache'):
            current_app.cache.clear()
        
        # Clear any weak references
        weakref.collect()
        
        logger.warning(f"{self.name}: Emergency cleanup completed")

class MemoryMonitor:
    """Memory usage monitoring with configurable thresholds and alerts."""
    
    _instance = None  # Singleton instance
    
    @classmethod
    def get_instance(cls, app: Optional[Flask] = None) -> 'MemoryMonitor':
        """
        Get or create the singleton instance.
        
        Args:
            app: Optional Flask application for configuration
        
        Returns:
            MemoryMonitor instance
        """
        if cls._instance is None:
            if app is None:
                cls._instance = cls()
            else:
                cls._instance = cls(
                    warning_threshold=app.config['MEMORY_WARNING_THRESHOLD'],
                    critical_threshold=app.config['MEMORY_CRITICAL_THRESHOLD'],
                    check_interval=app.config['MEMORY_CHECK_INTERVAL']
                )
        return cls._instance
    
    def __init__(self, 
                 warning_threshold: float = MEMORY_WARNING_THRESHOLD,
                 critical_threshold: float = MEMORY_CRITICAL_THRESHOLD,
                 check_interval: int = MEMORY_CHECK_INTERVAL):
        """
        Initialize memory monitor with configuration values.
        
        Args:
            warning_threshold: Memory usage percentage for warnings
            critical_threshold: Memory usage percentage for critical alerts
            check_interval: Seconds between checks
        """
        if self.__class__._instance is not None:
            raise RuntimeError("Use get_instance() instead")
        
        self.warning_threshold = warning_threshold
        self.critical_threshold = critical_threshold
        self.check_interval = check_interval
        self.last_check: Optional[datetime] = None
        self.monitoring_thread: Optional[threading.Thread] = None
        self.should_monitor = False
        self.status = MemoryStatus.NORMAL
        
        # Initialize cleanup strategies
        self.cleanup_strategies = [
            GCStrategy("GC Cleanup", warning_threshold),
            CacheClearStrategy("Cache Cleanup", warning_threshold + 10),
            EmergencyStrategy("Emergency Cleanup", critical_threshold)
        ]
        
        # Register cleanup on process exit
        atexit.register(self.stop)
    
    def start(self) -> None:
        """Start memory monitoring in background thread."""
        if not self.monitoring_thread:
            self.should_monitor = True
            self.monitoring_thread = threading.Thread(
                target=self.monitoring_loop,
                daemon=True,
                name="MemoryMonitor"
            )
            self.monitoring_thread.start()
            logger.info(
                f"Memory monitoring started (Warning: {self.warning_threshold}%, "
                f"Critical: {self.critical_threshold}%, "
                f"Interval: {self.check_interval}s)"
            )
    
    def stop(self) -> None:
        """Stop memory monitoring."""
        self.should_monitor = False
        if self.monitoring_thread:
            self.monitoring_thread.join(timeout=1.0)
            self.monitoring_thread = None
            logger.info("Memory monitoring stopped")
    
    def monitoring_loop(self) -> None:
        """Background monitoring loop."""
        while self.should_monitor:
            self.check_memory()
            time.sleep(self.check_interval)
    
    def check_memory(self) -> None:
        """Check memory usage and apply cleanup strategies if needed."""
        try:
            usage = self.get_memory_usage()
            self.last_check = datetime.utcnow()
            
            # Update status
            if usage['percent'] >= self.critical_threshold:
                self.status = MemoryStatus.CRITICAL
            elif usage['percent'] >= self.warning_threshold:
                self.status = MemoryStatus.WARNING
            else:
                self.status = MemoryStatus.NORMAL
            
            # Log memory usage at appropriate level
            log_msg = (
                f"Memory Usage - Process: {usage['percent']:.1f}%, "
                f"RSS: {usage['rss']:.1f}MB, "
                f"System: {usage['system_percent']:.1f}%"
            )
            
            if self.status == MemoryStatus.CRITICAL:
                logger.critical(log_msg)
            elif self.status == MemoryStatus.WARNING:
                logger.warning(log_msg)
            else:
                logger.debug(log_msg)
            
            # Apply cleanup strategies
            for strategy in self.cleanup_strategies:
                if strategy.should_run(usage):
                    strategy.cleanup()
                    
        except Exception as e:
            logger.error(f"Error checking memory usage: {str(e)}")
            self.status = MemoryStatus.ERROR
    
    def get_memory_usage(self) -> Dict[str, float]:
        """
        Get current memory usage statistics.
        
        Returns:
            Dict with memory usage percentages and values
        """
        process = psutil.Process()
        memory_info = process.memory_info()
        
        return {
            'percent': process.memory_percent(),
            'rss': memory_info.rss / (1024 * 1024),  # MB
            'vms': memory_info.vms / (1024 * 1024),  # MB
            'system_percent': psutil.virtual_memory().percent
        }

def init_memory_monitor(app: Flask) -> None:
    """
    Initialize the memory monitor for the Flask app.
    
    Args:
        app: Flask application instance
    """
    try:
        # Get or create monitor instance with app configuration
        monitor = MemoryMonitor.get_instance(app)
        
        # Store monitor in app context
        app.memory_monitor = monitor
        
        # Start monitoring
        monitor.start()
        
        # Register cleanup
        def cleanup(exception=None):
            monitor.stop()
        
        app.teardown_appcontext(cleanup)
        
        logger.info("Memory monitor initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize memory monitor: {str(e)}")
        raise 