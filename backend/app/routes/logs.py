"""
backend/app/routes/logs.py
==========================================
Log Access Routes
==========================================

Provides secure access to application logs through the API.
Implements log file reading, filtering, and real-time updates.

Author: Senior Developer
Date: 2024
"""

from flask import Blueprint, jsonify, request
from pathlib import Path
import os
import re
from datetime import datetime
from typing import List, Dict

logs = Blueprint('logs', __name__)

LOG_PATHS = {
    'processing': 'logs/processing.log',
    'performance': 'logs/performance.log',
    'error': 'logs/error.log',
    'frontend': 'logs/frontend.log'  # Added frontend log file
}

def parse_log_line(line: str) -> Dict:
    """Parse a log line into structured data"""
    try:
        # Match timestamp and level
        match = re.match(r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}) \[(\w+)\] (.*)', line)
        if match:
            timestamp, level, message = match.groups()
            return {
                'timestamp': timestamp,
                'level': level,
                'message': message
            }
        return None
    except Exception:
        return None

def read_last_logs(log_path: str, max_lines: int = 100) -> List[Dict]:
    """Read the last N lines from a log file"""
    try:
        if not os.path.exists(log_path):
            return []
            
        # Read last N lines
        with open(log_path, 'r') as f:
            lines = f.readlines()[-max_lines:]
            
        # Parse each line
        logs = []
        for line in lines:
            parsed = parse_log_line(line.strip())
            if parsed:
                logs.append(parsed)
                
        return logs
    except Exception as e:
        print(f"Error reading log file: {e}")
        return []

def write_logs(log_path: str, logs: List[Dict]) -> bool:
    """Write logs to the specified log file"""
    try:
        # Create logs directory if it doesn't exist
        os.makedirs('logs', exist_ok=True)
        
        # Format and write logs
        with open(log_path, 'a') as f:
            for log in logs:
                timestamp = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S,%f')[:-3]
                level = log.get('level', 'INFO').upper()
                message = log.get('message', '')
                f.write(f"{timestamp} [{level}] {message}\n")
        return True
    except Exception as e:
        print(f"Error writing logs: {e}")
        return False

@logs.route('/api/v1/logs/<log_type>', methods=['GET'])
def get_logs(log_type: str):
    """Get logs of specified type"""
    if log_type not in LOG_PATHS:
        return jsonify({'error': 'Invalid log type'}), 400
        
    log_path = LOG_PATHS[log_type]
    logs = read_last_logs(log_path)
    
    return jsonify({
        'logs': logs,
        'type': log_type,
        'timestamp': datetime.utcnow().isoformat()
    })

@logs.route('/api/v1/logs', methods=['POST'])
def submit_logs():
    """Submit logs from frontend"""
    try:
        # Get logs from request
        data = request.get_json()
        if not data or not isinstance(data, dict) or 'logs' not in data:
            return jsonify({'error': 'Invalid log format - expected {logs: [...]}'}), 400
            
        logs_data = data['logs']
        if not isinstance(logs_data, list):
            return jsonify({'error': 'Invalid log format - logs must be an array'}), 400
            
        # Write logs to frontend log file
        success = write_logs(LOG_PATHS['frontend'], logs_data)
        
        if success:
            return jsonify({'message': 'Logs submitted successfully'})
        else:
            return jsonify({'error': 'Failed to write logs'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500 