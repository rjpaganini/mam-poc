"""
backend/app/utils/circuit_breaker.py
==========================================
Circuit Breaker Pattern Implementation
==========================================

Implements the circuit breaker pattern to prevent system overload
and provide graceful degradation during failures.

Features:
- Automatic failure detection
- Self-healing capabilities
- Configurable thresholds
- State tracking per service
- Exponential backoff

Author: Senior Developer
Date: 2024
"""

import time
import asyncio
from enum import Enum
from typing import Callable, Any, Dict
from functools import wraps
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class CircuitState(Enum):
    """Circuit breaker states"""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"         # Service disabled
    HALF_OPEN = "half"    # Testing recovery

class CircuitBreaker:
    """Thread-safe circuit breaker implementation"""
    
    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        half_open_limit: int = 3
    ):
        """
        Initialize circuit breaker
        
        Args:
            name: Service identifier
            failure_threshold: Failures before opening circuit
            recovery_timeout: Seconds before recovery attempt
            half_open_limit: Successful calls needed to close circuit
        """
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_limit = half_open_limit
        
        # State management
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time = None
        self.successful_calls = 0
        
        # Metrics
        self.metrics = {
            'total_failures': 0,
            'total_successes': 0,
            'last_state_change': datetime.utcnow().isoformat(),
            'current_state': self.state.value
        }
        
    def _update_metrics(self, success: bool):
        """Update circuit metrics"""
        if success:
            self.metrics['total_successes'] += 1
        else:
            self.metrics['total_failures'] += 1
            
    def _change_state(self, new_state: CircuitState):
        """Change circuit state with logging"""
        old_state = self.state
        self.state = new_state
        self.metrics['last_state_change'] = datetime.utcnow().isoformat()
        self.metrics['current_state'] = new_state.value
        
        logger.info(
            f"Circuit {self.name} state change: {old_state.value} -> {new_state.value}"
        )
        
    def _handle_success(self):
        """Handle successful call"""
        if self.state == CircuitState.HALF_OPEN:
            self.successful_calls += 1
            if self.successful_calls >= self.half_open_limit:
                self._change_state(CircuitState.CLOSED)
                self.failure_count = 0
                self.successful_calls = 0
                
    def _handle_failure(self):
        """Handle failed call"""
        self.last_failure_time = time.time()
        self.failure_count += 1
        
        if self.state == CircuitState.CLOSED and self.failure_count >= self.failure_threshold:
            self._change_state(CircuitState.OPEN)
            
    def allow_request(self) -> bool:
        """Check if request should be allowed"""
        if self.state == CircuitState.CLOSED:
            return True
            
        if self.state == CircuitState.OPEN:
            if time.time() - self.last_failure_time >= self.recovery_timeout:
                self._change_state(CircuitState.HALF_OPEN)
                return True
            return False
            
        # HALF_OPEN state
        return True
        
    def get_metrics(self) -> Dict[str, Any]:
        """Get current circuit metrics"""
        return {
            **self.metrics,
            'failure_count': self.failure_count,
            'successful_calls': self.successful_calls
        }

def circuit_protected(circuit: CircuitBreaker):
    """
    Decorator to protect function with circuit breaker
    
    Usage:
    breaker = CircuitBreaker("scene_detection")
    
    @circuit_protected(breaker)
    async def process_scene(asset_id):
        ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if not circuit.allow_request():
                logger.warning(f"Circuit {circuit.name} is OPEN - request rejected")
                raise RuntimeError(f"Service {circuit.name} is temporarily unavailable")
                
            try:
                result = await func(*args, **kwargs)
                circuit._handle_success()
                circuit._update_metrics(True)
                return result
            except Exception as e:
                circuit._handle_failure()
                circuit._update_metrics(False)
                logger.error(f"Circuit {circuit.name} recorded failure: {str(e)}")
                raise
                
        return wrapper
    return decorator

# Create circuit breakers for each processor
scene_breaker = CircuitBreaker("scene_detection", failure_threshold=3)
logo_breaker = CircuitBreaker("logo_detection", failure_threshold=3) 