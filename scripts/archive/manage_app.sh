#!/bin/bash

# Application Manager Script v1.0.4
# DEPRECATED: Please use launch.sh instead
# This script is maintained only for legacy support and will be removed in future versions
# Migration guide:
#   - Use ./scripts/launch.sh start   (instead of ./scripts/manage_app.sh start)
#   - Use ./scripts/launch.sh stop    (instead of ./scripts/manage_app.sh stop)
#   - Use ./scripts/launch.sh restart (instead of ./scripts/manage_app.sh restart)

# Print deprecation warning
echo -e "\033[1;33m[WARN] This script is deprecated. Please use launch.sh instead.\033[0m"
echo -e "\033[1;33m[WARN] Run: ./scripts/launch.sh with the same commands\033[0m"
echo ""

# Get the absolute path to the project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Standardized logging setup - matches launch.sh
LOG_DIR="${PROJECT_DIR}/logs"
PID_DIR="${PROJECT_DIR}/pids"
mkdir -p "$LOG_DIR" "$PID_DIR"

# Define log files - matches launch.sh
LOG_APP="${LOG_DIR}/app.log"
LOG_ERROR="${LOG_DIR}/error.log"
LOG_BACKEND="${LOG_DIR}/backend.log"
LOG_FRONTEND="${LOG_DIR}/frontend.log"
LOG_ELECTRON="${LOG_DIR}/electron.log"

# Create log files with proper permissions
for log_file in "$LOG_APP" "$LOG_ERROR" "$LOG_BACKEND" "$LOG_FRONTEND" "$LOG_ELECTRON"; do
    touch "$log_file"
    chmod 644 "$log_file"
done

# Log rotation function (keeps last 5 files, max 10MB each)
rotate_log() {
    local log_file=$1
    if [[ -f "$log_file" ]] && [[ $(stat -f%z "$log_file") -gt 10485760 ]]; then
        for i in {4..1}; do
            [[ -f "${log_file}.$i" ]] && mv "${log_file}.$i" "${log_file}.$((i+1))"
        done
        mv "$log_file" "${log_file}.1"
        touch "$log_file"
        chmod 644 "$log_file"
    fi
}

# Logging function with rotation - matches launch.sh
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local log_entry="${timestamp} [${level}] ${message}"
    
    # Write to appropriate log file
    case $level in
        "ERROR")
            echo "$log_entry" >> "$LOG_ERROR"
            rotate_log "$LOG_ERROR"
            ;;
        *)
            echo "$log_entry" >> "$LOG_APP"
            rotate_log "$LOG_APP"
            ;;
    esac
    
    # Terminal output with colors
    case $level in
        "ERROR") echo -e "\033[0;31m[ERROR] ${message}\033[0m" ;;
        "SUCCESS") echo -e "\033[0;32m[SUCCESS] ${message}\033[0m" ;;
        "WARN") echo -e "\033[1;33m[WARN] ${message}\033[0m" ;;
        "INFO") echo -e "\033[0;34m[INFO] ${message}\033[0m" ;;
    esac
}

# Safe process checking - ensures we only kill our own processes
is_our_process() {
    local pid=$1
    local process_cmd
    
    # Get process command
    process_cmd=$(ps -p "$pid" -o command= 2>/dev/null)
    
    # Check if process belongs to our project
    [[ "$process_cmd" == *"${PROJECT_DIR}"* ]] && return 0
    return 1
}

# Safe port checking - only checks if port is used by our application
check_port() {
    local port=$1
    local pids
    
    # Get PIDs using the port
    pids=$(lsof -ti :"$port" 2>/dev/null)
    
    # No process using the port
    [[ -z "$pids" ]] && return 1
    
    # Check each PID
    for pid in $pids; do
        if is_our_process "$pid"; then
            return 0
        fi
    done
    
    return 1
}

# Safe process termination - only kills processes that belong to our application
safe_kill() {
    local pid=$1
    local retries=3
    
    # Only proceed if it's our process
    if ! is_our_process "$pid"; then
        log "WARN" "Process $pid does not belong to our application, skipping"
        return 1
    fi
    
    # Try graceful shutdown first
    kill -15 "$pid" 2>/dev/null
    
    # Wait and check if process is still running
    while ((retries > 0)) && kill -0 "$pid" 2>/dev/null; do
        sleep 1
        ((retries--))
    done
    
    # Only use SIGKILL as last resort
    if kill -0 "$pid" 2>/dev/null; then
        log "WARN" "Process $pid not responding to SIGTERM, using SIGKILL"
        kill -9 "$pid" 2>/dev/null
    fi
}

# Safe port clearing - only kills processes that belong to our application
safe_clear_port() {
    local port=$1
    local pids
    
    pids=$(lsof -ti :"$port" 2>/dev/null)
    for pid in $pids; do
        if is_our_process "$pid"; then
            safe_kill "$pid"
        else
            log "WARN" "Port $port is in use by another application (PID: $pid)"
        fi
    done
}

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

# Command handlers
start_dev() {
    log "INFO" "Starting development environment..."
    kill_services
    
    # Start backend and wait for it to be healthy
    if cd backend && source .venv/bin/activate; then
        # Start backend without redirecting output
        python -m app.main & 
        echo $! > "${PID_DIR}/backend.pid"
        
        # Wait for backend to be healthy (reduced to 10 seconds)
        local retries=0
        while ! check_backend_health && [ $retries -lt 10 ]; do
            sleep 1
            ((retries++))
            log "INFO" "Waiting for backend to be healthy... ($retries/10)"
        done
        
        if [ $retries -eq 10 ]; then
            log "ERROR" "Backend failed to start - check logs for errors"
            kill_services
            return 1
        fi
        
        log "SUCCESS" "Backend started on port $BACKEND_PORT"
    else
        log "ERROR" "Failed to start backend"
        return 1
    fi
    
    # Start frontend
    if cd ../frontend; then
        npm run dev > "$LOG_FRONTEND" 2>&1 & 
        echo $! > "${PID_DIR}/frontend.pid"
        
        # Wait for frontend to be ready
        retries=0
        while ! curl -s "http://localhost:$FRONTEND_PORT" >/dev/null && [ $retries -lt 30 ]; do
            sleep 1
            ((retries++))
            log "INFO" "Waiting for frontend to be ready... ($retries/30)"
        done
        
        if [ $retries -eq 30 ]; then
            log "ERROR" "Frontend failed to start"
            kill_services
            return 1
        fi
        
        log "SUCCESS" "Frontend started on port $FRONTEND_PORT"
    else
        log "ERROR" "Failed to start frontend"
        kill_services
        return 1
    fi
}

kill_services() {
    log "INFO" "Stopping all services..."
    
    # First, try graceful shutdown of known processes
    for pid_file in "$PID_DIR"/*.pid; do
        if [ -f "$pid_file" ]; then
            pid=$(cat "$pid_file")
            safe_kill "$pid"
            rm "$pid_file"
        fi
    done
    
    # More aggressive cleanup for known service patterns
    pkill -f "python.*wsgi.py" || true
    pkill -f "python.*websocket" || true
    pkill -f "node.*react-scripts" || true
    pkill -f "electron.*${PROJECT_DIR}" || true
    
    # Give processes time to shut down
    sleep 2
    
    # Force kill anything still on our ports
    for port in $FRONTEND_PORT $BACKEND_PORT; do
        local pids=$(lsof -ti :$port 2>/dev/null)
        if [ -n "$pids" ]; then
            log "WARN" "Force killing processes on port $port: $pids"
            echo "$pids" | xargs kill -9 2>/dev/null || true
        fi
    done
    
    # Clean up any leftover PID files
    rm -f "$PID_DIR"/*.pid 2>/dev/null || true
    
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
    # Check backend
    if check_backend_health; then
        log "SUCCESS" "Backend is running"
    else
        log "ERROR" "Backend is not running"
    fi

    # Check React server
    if check_port "$FRONTEND_PORT"; then
        log "SUCCESS" "React server is running"
    else
        log "ERROR" "React server is not running"
    fi

    # Check Electron
    if pgrep -f "electron.*$PROJECT_DIR" >/dev/null; then
        log "SUCCESS" "Electron is running"
    else
        log "ERROR" "Electron is not running"
    fi
}

check_backend_health() {
    # First check if port is listening
    if ! check_port "$BACKEND_PORT"; then
        return 1
    fi
    
    # Check if health endpoint returns 200
    local response=$(curl -s "http://localhost:${BACKEND_PORT}/api/v1/health/status")
    local status_code=$?
    
    # Check for obvious errors in response
    if echo "$response" | grep -q "eventlet.*monkey_patch"; then
        log "ERROR" "Eventlet initialization error detected"
        return 1
    fi
    
    if [ "$status_code" = "200" ]; then
        return 0
    else
        return 1
    fi
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