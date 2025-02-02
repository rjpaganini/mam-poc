# health.py - System Health Monitoring
# Purpose: Provides health check endpoints and system status information

from flask import Blueprint, jsonify, current_app
from datetime import datetime, timedelta
import psutil
import logging
import os
from typing import Dict, Any, Optional
from .config import API_PREFIX

# Configure module-level logger
logger = logging.getLogger(__name__)

# Create blueprint with versioned prefix
health = Blueprint('health', __name__, url_prefix=f'{API_PREFIX}/health')

class HealthStatus:
    """Health status constants."""
    HEALTHY = 'healthy'
    DEGRADED = 'degraded'
    CRITICAL = 'critical'
    ERROR = 'error'

def get_process_metrics() -> Dict[str, Any]:
    """Get current process metrics."""
    process = psutil.Process()
    
    # Get process information
    with process.oneshot():  # Get all process info in a single system call
        cpu_times = process.cpu_times()
        memory_info = process.memory_info()
        io_counters = process.io_counters()
        
        return {
            'cpu': {
                'user': cpu_times.user,
                'system': cpu_times.system,
                'threads': process.num_threads()
            },
            'memory': {
                'rss_mb': memory_info.rss / (1024 * 1024),
                'vms_mb': memory_info.vms / (1024 * 1024),
                'percent': process.memory_percent()
            },
            'io': {
                'read_mb': io_counters.read_bytes / (1024 * 1024),
                'write_mb': io_counters.write_bytes / (1024 * 1024)
            },
            'uptime': (datetime.now() - datetime.fromtimestamp(process.create_time())).total_seconds()
        }

def get_system_metrics() -> Dict[str, Any]:
    """Get system-wide metrics."""
    vm = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    return {
        'cpu': {
            'percent': psutil.cpu_percent(interval=0.1),
            'count': psutil.cpu_count(),
            'freq_mhz': psutil.cpu_freq().current if hasattr(psutil.cpu_freq(), 'current') else None
        },
        'memory': {
            'total_gb': vm.total / (1024 ** 3),
            'available_gb': vm.available / (1024 ** 3),
            'percent': vm.percent
        },
        'disk': {
            'total_gb': disk.total / (1024 ** 3),
            'free_gb': disk.free / (1024 ** 3),
            'percent': disk.percent
        }
    }

def determine_health_status(metrics: Dict[str, Any]) -> str:
    """
    Determine overall system health status based on metrics.
    
    Args:
        metrics: System and process metrics
        
    Returns:
        str: Health status (healthy, degraded, critical)
    """
    try:
        # Check critical thresholds
        if (metrics['system']['memory']['percent'] > 90 or
            metrics['system']['disk']['percent'] > 95 or
            metrics['process']['memory']['percent'] > 90):
            return HealthStatus.CRITICAL
            
        # Check warning thresholds
        if (metrics['system']['memory']['percent'] > 75 or
            metrics['system']['disk']['percent'] > 80 or
            metrics['process']['memory']['percent'] > 75):
            return HealthStatus.DEGRADED
            
        return HealthStatus.HEALTHY
        
    except Exception as e:
        logger.error(f"Error determining health status: {e}")
        return HealthStatus.ERROR

def get_system_status() -> Dict[str, Any]:
    """
    Get comprehensive system status information.
    
    Returns:
        Dict containing system health metrics
    """
    try:
        # Get memory monitor stats if available
        memory_monitor_stats = {}
        if hasattr(current_app, 'memory_monitor'):
            monitor = current_app.memory_monitor
            memory_monitor_stats = {
                'last_check': monitor.last_check.isoformat() if monitor.last_check else None,
                'warning_threshold': monitor.warning_threshold,
                'critical_threshold': monitor.critical_threshold
            }
        
        # Collect all metrics
        metrics = {
            'timestamp': datetime.utcnow().isoformat(),
            'process': get_process_metrics(),
            'system': get_system_metrics(),
            'memory_monitor': memory_monitor_stats
        }
        
        # Determine overall health
        status = determine_health_status(metrics)
        
        return {
            'status': status,
            'metrics': metrics
        }
        
    except Exception as e:
        logger.error(f"Error getting system status: {str(e)}")
        return {
            'status': HealthStatus.ERROR,
            'timestamp': datetime.utcnow().isoformat(),
            'error': str(e)
        }

@health.route('/')
def health_check():
    """Basic health check endpoint."""
    try:
        status = get_system_status()
        return jsonify({
            'status': status['status'],
            'timestamp': datetime.utcnow().isoformat()
        }), 200 if status['status'] == HealthStatus.HEALTHY else 503
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': HealthStatus.ERROR,
            'error': str(e)
        }), 500

@health.route('/status')
def detailed_status():
    """Detailed system status endpoint."""
    try:
        status = get_system_status()
        return jsonify(status), 200 if status['status'] == HealthStatus.HEALTHY else 503
    except Exception as e:
        logger.error(f"Detailed status check failed: {e}")
        return jsonify({
            'status': HealthStatus.ERROR,
            'error': str(e)
        }), 500

def init_health(app):
    """
    Initialize health monitoring endpoints.
    
    Args:
        app: Flask application instance
    """
    try:
        # Register blueprint
        app.register_blueprint(health)
        logger.info("Health monitoring endpoints initialized")
        
    except Exception as e:
        logger.error(f"Failed to initialize health monitoring: {str(e)}")
        raise 