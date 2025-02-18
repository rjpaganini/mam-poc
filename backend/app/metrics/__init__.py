"""
Metrics Package for AWS Usage Tracking
====================================

This package handles persistent storage and tracking of AWS service usage.
Uses SQLite for storage and provides an API for the frontend to visualize metrics.

Components:
1. Database Models - Track usage per service
2. Metrics Collection - Gather AWS metrics
3. API Endpoints - Expose metrics to frontend
"""

from .models import MetricsDB
from .collector import MetricsCollector

__all__ = ['MetricsDB', 'MetricsCollector'] 