#!/bin/bash

# Unified Management Script for Media Asset Manager v1.0.2
# Handles development, production, and maintenance tasks
# Author: Claude
# Date: 2024-02-07

# Get absolute path and cd to project root
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Setup logging
LOG_DIR="${PROJECT_DIR}/logs"
LOG_FILE="${LOG_DIR}/app_manager.log"
PID_DIR="${PROJECT_DIR}/pids"
mkdir -p "$LOG_DIR" "$PID_DIR"

# Load environment variables
source .env 2>/dev/null || true

# Constants
FRONTEND_PORT=${FRONTEND_PORT:-3001}
BACKEND_PORT=${BACKEND_PORT:-5001}

# Color codes and logging
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "${timestamp} [${level}] ${message}" >> "$LOG_FILE"
    case $level in
        "ERROR") echo -e "${RED}[ERROR] ${message}${NC}" ;;
        "SUCCESS") echo -e "${GREEN}[SUCCESS] ${message}${NC}" ;;
        "WARN") echo -e "${YELLOW}[WARN] ${message}${NC}" ;;
        "INFO") echo -e "${BLUE}[INFO] ${message}${NC}" ;;
    esac
}

# Command handlers
start_dev() {
    log "INFO" "Starting development environment..."
    kill_services
    
    # Start backend
    if cd backend && source .venv/bin/activate; then
        FLASK_APP=wsgi.py FLASK_ENV=development FLASK_DEBUG=1 \
        python wsgi.py > "${LOG_DIR}/backend.log" 2>&1 & 
        echo $! > "${PID_DIR}/backend.pid"
        log "SUCCESS" "Backend started on port $BACKEND_PORT"
    else
        log "ERROR" "Failed to start backend"
        return 1
    fi
    
    # Start frontend
    if cd ../frontend; then
        npm run dev > "${LOG_DIR}/frontend.log" 2>&1 & 
        echo $! > "${PID_DIR}/frontend.pid"
        log "SUCCESS" "Frontend started on port $FRONTEND_PORT"
    else
        log "ERROR" "Failed to start frontend"
        kill_services
        return 1
    fi
}

kill_services() {
    log "INFO" "Stopping all services..."
    
    # Graceful shutdown first
    for pid_file in "$PID_DIR"/*.pid; do
        if [ -f "$pid_file" ]; then
            pid=$(cat "$pid_file")
            kill -15 "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
            rm "$pid_file"
        fi
    done
    
    # Kill any remaining processes
    for port in $FRONTEND_PORT $BACKEND_PORT; do
        if lsof -ti:$port -sTCP:LISTEN >/dev/null; then
            lsof -ti:$port -sTCP:LISTEN | xargs kill -15 2>/dev/null || \
            lsof -ti:$port -sTCP:LISTEN | xargs kill -9 2>/dev/null || true
        fi
    done
    
    log "SUCCESS" "All services stopped"
}

scan_media() {
    log "INFO" "Starting media scan..."
    
    # Check if backend is running
    if ! check_backend_health; then
        log "ERROR" "Backend service must be running to scan media"
        return 1
    fi

    # Get media path from environment
    source "$PROJECT_DIR/.env"
    if [ -z "$MEDIA_PATH" ]; then
        log "ERROR" "MEDIA_PATH not set in .env"
        return 1
    fi

    # Validate media directory
    if [ ! -d "$MEDIA_PATH" ]; then
        log "ERROR" "Media directory not found: $MEDIA_PATH"
        return 1
    fi

    # Call backend scan endpoint
    log "INFO" "Scanning directory: $MEDIA_PATH"
    curl -s -X POST "http://localhost:${BACKEND_PORT}/api/v1/media/scan" \
        -H "Content-Type: application/json" \
        -d "{\"path\": \"$MEDIA_PATH\"}"

    if [ $? -eq 0 ]; then
        log "SUCCESS" "Media scan initiated successfully"
    else
        log "ERROR" "Failed to initiate media scan"
        return 1
    fi
}

check_health() {
    log "INFO" "Checking system health..."
    local health_status=$(curl -s http://localhost:$BACKEND_PORT/api/v1/health/status)
    if [ $? -eq 0 ]; then
        echo "$health_status" | jq .
        log "SUCCESS" "Health check completed"
    else
        log "ERROR" "Health check failed"
        return 1
    fi
}

check_services_status() {
    log "INFO" "Checking services status..."
    if [ -f "$PID_DIR/backend.pid" ] && [ -f "$PID_DIR/frontend.pid" ]; then
        log "SUCCESS" "All services are running"
    else
        log "WARN" "Some services are not running"
    fi
}

check_backend_health() {
    curl -s "http://localhost:${BACKEND_PORT}/api/v1/health/status" > /dev/null
    return $?
}

# Enhanced command router
case "$1" in
    start)
        start_dev
        ;;
    stop)
        kill_services
        ;;
    restart)
        kill_services
        start_dev
        ;;
    scan)
        scan_media
        ;;
    health)
        check_health
        ;;
    status)
        check_services_status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|scan|health|status}"
        exit 1
        ;;
esac 