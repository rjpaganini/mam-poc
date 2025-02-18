"""
SQLite Database Models for AWS Metrics
====================================

Defines the schema for storing AWS usage metrics:
- Service usage (Lambda, S3, Rekognition)
- Cost tracking
- Performance metrics
- Alerts and thresholds
"""

import sqlite3
from datetime import datetime
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

class MetricsDB:
    """Handles SQLite database operations for metrics storage"""
    
    def __init__(self, db_path: str = "data/metrics.db"):
        """Initialize database connection"""
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Initialize database
        self.conn = sqlite3.connect(str(self.db_path))
        self.create_tables()
        logger.info(f"Metrics database initialized at {self.db_path}")
    
    def create_tables(self):
        """Create necessary database tables if they don't exist"""
        with self.conn:
            # Service Usage Table
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS service_usage (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    service TEXT NOT NULL,
                    operation TEXT NOT NULL,
                    amount INTEGER NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    metadata TEXT
                )
            """)
            
            # Lambda Metrics Table (Enhanced)
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS lambda_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    function_name TEXT NOT NULL,
                    metric_name TEXT NOT NULL,
                    value REAL NOT NULL,
                    timestamp DATETIME NOT NULL,
                    metadata TEXT
                )
            """)
            
            # S3 Metrics Table
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS s3_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    bucket_name TEXT NOT NULL,
                    metric_name TEXT NOT NULL,
                    value REAL NOT NULL,
                    timestamp DATETIME NOT NULL,
                    metadata TEXT
                )
            """)
            
            # Cost Tracking Table
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS cost_tracking (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    service TEXT NOT NULL,
                    cost_usd REAL NOT NULL,
                    usage_amount INTEGER,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    metadata TEXT
                )
            """)
            
            # Alerts Table
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    service TEXT NOT NULL,
                    alert_type TEXT NOT NULL,
                    value REAL NOT NULL,
                    threshold REAL NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    status TEXT DEFAULT 'active',
                    metadata TEXT
                )
            """)
    
    def record_service_usage(self, service: str, operation: str, amount: int = 1, 
                           metadata: Optional[Dict[str, Any]] = None):
        """Record usage of an AWS service"""
        try:
            with self.conn:
                self.conn.execute(
                    "INSERT INTO service_usage (service, operation, amount, metadata) VALUES (?, ?, ?, ?)",
                    (service, operation, amount, json.dumps(metadata) if metadata else None)
                )
        except Exception as e:
            logger.error(f"Failed to record service usage: {e}")
    
    def record_lambda_metric(self, function_name: str, metric_name: str, 
                           value: float, timestamp: datetime,
                           metadata: Optional[Dict[str, Any]] = None):
        """Record Lambda metric"""
        try:
            with self.conn:
                self.conn.execute(
                    """INSERT INTO lambda_metrics 
                       (function_name, metric_name, value, timestamp, metadata)
                       VALUES (?, ?, ?, ?, ?)""",
                    (function_name, metric_name, value, timestamp.isoformat(),
                     json.dumps(metadata) if metadata else None)
                )
        except Exception as e:
            logger.error(f"Failed to record lambda metric: {e}")
    
    def record_s3_metric(self, bucket_name: str, metric_name: str,
                        value: float, timestamp: datetime,
                        metadata: Optional[Dict[str, Any]] = None):
        """Record S3 metric"""
        try:
            with self.conn:
                self.conn.execute(
                    """INSERT INTO s3_metrics 
                       (bucket_name, metric_name, value, timestamp, metadata)
                       VALUES (?, ?, ?, ?, ?)""",
                    (bucket_name, metric_name, value, timestamp.isoformat(),
                     json.dumps(metadata) if metadata else None)
                )
        except Exception as e:
            logger.error(f"Failed to record S3 metric: {e}")
    
    def record_cost(self, service: str, cost_usd: float, 
                   usage_amount: Optional[int] = None, 
                   metadata: Optional[Dict[str, Any]] = None):
        """Record cost for an AWS service"""
        try:
            with self.conn:
                self.conn.execute(
                    "INSERT INTO cost_tracking (service, cost_usd, usage_amount, metadata) VALUES (?, ?, ?, ?)",
                    (service, cost_usd, usage_amount, json.dumps(metadata) if metadata else None)
                )
        except Exception as e:
            logger.error(f"Failed to record cost: {e}")
    
    def record_alert(self, service: str, alert_type: str, value: float,
                    threshold: float, metadata: Optional[Dict[str, Any]] = None):
        """Record alert when threshold is exceeded"""
        try:
            with self.conn:
                self.conn.execute(
                    """INSERT INTO alerts 
                       (service, alert_type, value, threshold, metadata)
                       VALUES (?, ?, ?, ?, ?)""",
                    (service, alert_type, value, threshold,
                     json.dumps(metadata) if metadata else None)
                )
        except Exception as e:
            logger.error(f"Failed to record alert: {e}")
    
    def get_service_usage(self, service: Optional[str] = None, 
                         days: int = 30) -> List[Dict[str, Any]]:
        """Get service usage statistics"""
        try:
            query = """
                SELECT service, operation, SUM(amount) as total_usage,
                       COUNT(*) as operation_count,
                       MIN(timestamp) as first_usage,
                       MAX(timestamp) as last_usage
                FROM service_usage
                WHERE timestamp >= datetime('now', ?)
            """
            params = [f'-{days} days']
            
            if service:
                query += " AND service = ?"
                params.append(service)
                
            query += " GROUP BY service, operation"
            
            with self.conn:
                cursor = self.conn.execute(query, params)
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Failed to get service usage: {e}")
            return []
    
    def get_lambda_metrics(self, function_name: Optional[str] = None,
                         hours: int = 24) -> List[Dict[str, Any]]:
        """Get Lambda metrics with enhanced data"""
        try:
            query = """
                SELECT function_name,
                       metric_name,
                       AVG(value) as avg_value,
                       MAX(value) as max_value,
                       MIN(value) as min_value,
                       COUNT(*) as sample_count,
                       json_group_array(json_object(
                           'timestamp', timestamp,
                           'value', value,
                           'metadata', metadata
                       )) as time_series
                FROM lambda_metrics
                WHERE timestamp >= datetime('now', ?)
            """
            params = [f'-{hours} hours']
            
            if function_name:
                query += " AND function_name = ?"
                params.append(function_name)
                
            query += " GROUP BY function_name, metric_name"
            
            with self.conn:
                cursor = self.conn.execute(query, params)
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Failed to get lambda metrics: {e}")
            return []
    
    def get_s3_metrics(self, bucket_name: Optional[str] = None,
                       metric_name: Optional[str] = None,
                       hours: int = 24) -> List[Dict[str, Any]]:
        """Get S3 metrics"""
        try:
            query = """
                SELECT bucket_name,
                       metric_name,
                       AVG(value) as avg_value,
                       MAX(value) as max_value,
                       MIN(value) as min_value,
                       COUNT(*) as sample_count,
                       json_group_array(json_object(
                           'timestamp', timestamp,
                           'value', value,
                           'metadata', metadata
                       )) as time_series
                FROM s3_metrics
                WHERE timestamp >= datetime('now', ?)
            """
            params = [f'-{hours} hours']
            
            if bucket_name:
                query += " AND bucket_name = ?"
                params.append(bucket_name)
                
            if metric_name:
                query += " AND metric_name = ?"
                params.append(metric_name)
                
            query += " GROUP BY bucket_name, metric_name"
            
            with self.conn:
                cursor = self.conn.execute(query, params)
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Failed to get S3 metrics: {e}")
            return []
    
    def get_costs(self, days: int = 30) -> List[Dict[str, Any]]:
        """Get cost breakdown by service"""
        try:
            query = """
                SELECT service,
                       SUM(cost_usd) as total_cost,
                       SUM(usage_amount) as total_usage,
                       COUNT(*) as charge_count,
                       MIN(timestamp) as first_charge,
                       MAX(timestamp) as last_charge
                FROM cost_tracking
                WHERE timestamp >= datetime('now', ?)
                GROUP BY service
            """
            
            with self.conn:
                cursor = self.conn.execute(query, [f'-{days} days'])
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Failed to get costs: {e}")
            return []
    
    def get_alerts(self, service: Optional[str] = None,
                  hours: int = 24) -> List[Dict[str, Any]]:
        """Get recent alerts"""
        try:
            query = """
                SELECT service,
                       alert_type,
                       value,
                       threshold,
                       timestamp,
                       status,
                       metadata
                FROM alerts
                WHERE timestamp >= datetime('now', ?)
            """
            params = [f'-{hours} hours']
            
            if service:
                query += " AND service = ?"
                params.append(service)
                
            query += " ORDER BY timestamp DESC"
            
            with self.conn:
                cursor = self.conn.execute(query, params)
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Failed to get alerts: {e}")
            return [] 