#!/bin/bash

# Unified Management Script for Media Asset Manager
# Handles development, production, and maintenance tasks

# Load environment variables
source .env 2>/dev/null || true

# Constants
FRONTEND_PORT=3001
BACKEND_PORT=5001
LOG_DIR="logs"
PID_DIR="pids"

# Create necessary directories
mkdir -p "$LOG_DIR" "$PID_DIR"

# Command handlers
start_dev() {
    echo "Starting development environment..."
    # Kill existing processes
    kill_services
    # Start backend
    cd backend && source venv/bin/activate && \
    FLASK_APP=app.py FLASK_ENV=development FLASK_DEBUG=1 \
    flask run --port=$BACKEND_PORT > "../$LOG_DIR/backend.log" 2>&1 & echo $! > "../$PID_DIR/backend.pid"
    # Start frontend
    cd ../frontend && npm run dev > "../$LOG_DIR/frontend.log" 2>&1 & echo $! > "../$PID_DIR/frontend.pid"
}

kill_services() {
    echo "Stopping all services..."
    for pid_file in "$PID_DIR"/*.pid; do
        if [ -f "$pid_file" ]; then
            pid=$(cat "$pid_file")
            kill -9 "$pid" 2>/dev/null || true
            rm "$pid_file"
        fi
    done
    # Kill any remaining processes on our ports
    lsof -ti:$FRONTEND_PORT -sTCP:LISTEN | xargs kill -9 2>/dev/null || true
    lsof -ti:$BACKEND_PORT -sTCP:LISTEN | xargs kill -9 2>/dev/null || true
}

scan_media() {
    echo "Scanning media directory..."
    cd backend && source venv/bin/activate && \
    python -c "from app.tasks.scanner import scan_media_directory; scan_media_directory()"
}

check_health() {
    echo "Checking system health..."
    curl -s http://localhost:$BACKEND_PORT/api/v1/health/status | jq .
}

# Command router
case "$1" in
    "start")     start_dev ;;
    "stop")      kill_services ;;
    "restart")   kill_services && start_dev ;;
    "scan")      scan_media ;;
    "health")    check_health ;;
    *)          echo "Usage: $0 {start|stop|restart|scan|health}" ;;
esac 