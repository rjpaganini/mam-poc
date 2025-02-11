"""
backend/app/utils/tracing.py
==========================================
Request Tracing System
==========================================

Implements distributed tracing for request debugging.
Tracks request flow through the system with minimal overhead.

Features:
- Request correlation IDs
- Timing for each processing step
- Parent-child relationship tracking
- Error context preservation
- Async support

Author: Senior Developer
Date: 2024
"""

import uuid
import time
import asyncio
import contextvars
import functools
from typing import Dict, List, Optional, Any
from datetime import datetime
import logging
import json
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)

# Context variable to track current trace
current_trace = contextvars.ContextVar('current_trace', default=None)

@dataclass
class TraceSpan:
    """Single unit of work within a trace"""
    id: str
    parent_id: Optional[str]
    name: str
    start_time: float
    end_time: Optional[float] = None
    metadata: Dict[str, Any] = None
    error: Optional[Dict[str, str]] = None
    
    def duration(self) -> float:
        """Get span duration in milliseconds"""
        if self.end_time:
            return (self.end_time - self.start_time) * 1000
        return 0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging"""
        return {
            'id': self.id,
            'parent_id': self.parent_id,
            'name': self.name,
            'duration_ms': self.duration(),
            'start_time': datetime.fromtimestamp(self.start_time).isoformat(),
            'end_time': datetime.fromtimestamp(self.end_time).isoformat() if self.end_time else None,
            'metadata': self.metadata,
            'error': self.error
        }

class RequestTrace:
    """Complete trace of a request through the system"""
    
    def __init__(self, trace_id: str = None):
        self.trace_id = trace_id or str(uuid.uuid4())
        self.spans: List[TraceSpan] = []
        self.start_time = time.time()
        self.metadata: Dict[str, Any] = {}
        
    def add_span(self, name: str, parent_id: str = None, metadata: Dict[str, Any] = None) -> TraceSpan:
        """Add a new span to the trace"""
        span = TraceSpan(
            id=str(uuid.uuid4()),
            parent_id=parent_id,
            name=name,
            start_time=time.time(),
            metadata=metadata or {}
        )
        self.spans.append(span)
        return span
        
    def end_span(self, span_id: str, error: Exception = None):
        """End a span, optionally with error"""
        for span in self.spans:
            if span.id == span_id:
                span.end_time = time.time()
                if error:
                    span.error = {
                        'type': type(error).__name__,
                        'message': str(error)
                    }
                break
                
    def to_dict(self) -> Dict[str, Any]:
        """Convert entire trace to dictionary"""
        return {
            'trace_id': self.trace_id,
            'duration_ms': (time.time() - self.start_time) * 1000,
            'spans': [span.to_dict() for span in self.spans],
            'metadata': self.metadata
        }
        
    def log(self):
        """Log the trace for debugging"""
        logger.info(f"Request trace {self.trace_id}:\n{json.dumps(self.to_dict(), indent=2)}")

def trace_request(name: str, metadata: Dict[str, Any] = None):
    """
    Decorator to trace a request or operation
    
    Usage:
    @trace_request('get_asset')
    async def get_asset(asset_id):
        ...
    """
    def decorator(func):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            # Get or create trace
            trace = current_trace.get()
            if not trace:
                trace = RequestTrace()
                current_trace.set(trace)
            
            # Create span
            span = trace.add_span(name, metadata=metadata)
            try:
                result = await func(*args, **kwargs)
                trace.end_span(span.id)
                return result
            except Exception as e:
                trace.end_span(span.id, error=e)
                raise
            finally:
                if not span.parent_id:  # Root span
                    trace.log()
                    
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            # Get or create trace
            trace = current_trace.get()
            if not trace:
                trace = RequestTrace()
                current_trace.set(trace)
            
            # Create span
            span = trace.add_span(name, metadata=metadata)
            try:
                result = func(*args, **kwargs)
                trace.end_span(span.id)
                return result
            except Exception as e:
                trace.end_span(span.id, error=e)
                raise
            finally:
                if not span.parent_id:  # Root span
                    trace.log()
        
        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
    return decorator

def get_current_trace() -> Optional[RequestTrace]:
    """Get the current request trace if it exists"""
    return current_trace.get()

def set_trace_metadata(key: str, value: Any):
    """Set metadata for the current trace"""
    trace = current_trace.get()
    if trace:
        trace.metadata[key] = value 