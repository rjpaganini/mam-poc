#!/bin/bash

# Launch script for MAM Application v1.0.4
# Handles both backend services and Electron app
# Author: Claude
# Date: 2025-02-11

# Get the absolute path to the project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Create PID directory
PID_DIR="${PROJECT_DIR}/pids"
mkdir -p "$PID_DIR"

# Standardized logging setup
LOG_DIR="${PROJECT_DIR}/logs"
mkdir -p "$LOG_DIR"

# Define log files
LOG_APP="${LOG_DIR}/app.log"
LOG_ERROR="${LOG_DIR}/error.log"
LOG_BACKEND="${LOG_DIR}/backend.log"
LOG_FRONTEND="${LOG_DIR}/frontend.log"
LOG_ELECTRON="${LOG_DIR}/electron.log"
LOG_WEBSOCKET="${LOG_DIR}/websocket.log"

# Create log files with proper permissions
for log_file in "$LOG_APP" "$LOG_ERROR" "$LOG_BACKEND" "$LOG_FRONTEND" "$LOG_ELECTRON" "$LOG_WEBSOCKET"; do
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

# Logging function with rotation
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

# Kill a process with verification (optimized)
safe_kill() {
    local pid=$1
    
    # Try SIGTERM first
    kill -15 "$pid" 2>/dev/null
    
    # Shorter wait with more frequent checks
    for i in {1..6}; do
        if ! kill -0 "$pid" 2>/dev/null; then
            return 0  # Process is dead
        fi
        sleep 0.5
    done
    
    # Force kill if still alive
    kill -9 "$pid" 2>/dev/null
    sleep 0.5  # Brief wait to ensure cleanup
}

# Clear a port and verify it's free
safe_clear_port() {
    local port=$1
    local pids=$(lsof -ti :"$port" 2>/dev/null)
    
    # No process using port
    if [ -z "$pids" ]; then
        return 0
    fi
    
    # Kill each process
    for pid in $pids; do
        safe_kill "$pid"
    done
    
    # Verify port is free
    if lsof -ti :"$port" >/dev/null 2>&1; then
        log "ERROR" "Failed to free port $port"
        return 1
    fi
    
    return 0
}

# Function to safely check if a port is in use by our application
check_app_port() {
    local port=$1
    local count=$(lsof -ti :$port 2>/dev/null | wc -l)
    return $(( count > 0 ))
}

# Function to kill Electron app - more aggressive
kill_electron() {
    log "INFO" "Stopping Electron app..."
    # Kill both Electron and node processes for our frontend
    pkill -f "electron.*${PROJECT_DIR}/frontend" 2>/dev/null || true
    pkill -f "node.*${PROJECT_DIR}/frontend" 2>/dev/null || true
    
    # Wait and verify
    local retries=0
    while pgrep -f "electron.*${PROJECT_DIR}/frontend" > /dev/null && [ $retries -lt 10 ]; do
        sleep 0.5
        ((retries++))
        # If still running after 5 attempts, force kill
        if [ $retries -eq 5 ]; then
            pkill -9 -f "electron.*${PROJECT_DIR}/frontend" 2>/dev/null || true
        fi
    done
    
    # Final verification
    if pgrep -f "electron.*${PROJECT_DIR}/frontend" > /dev/null; then
        log "ERROR" "Failed to stop Electron app"
        return 1
    fi
    return 0
}

# Stop all services
stop_services() {
    log "INFO" "Stopping all MAM services..."
    local failed=0
    
    # Kill Electron first and verify
    kill_electron || failed=1
    
    # Then clear ports
    safe_clear_port 3001 || failed=1  # Frontend
    safe_clear_port 5001 || failed=1  # Backend last
    
    if [ $failed -eq 1 ]; then
        log "ERROR" "Failed to stop all services"
        return 1
    fi
    
    log "SUCCESS" "All services stopped"
    return 0
}

# Start backend service with proper entry point
start_backend() {
    log "INFO" "Starting backend service..."
    
    # Ensure backend port is free
    safe_clear_port 5001
    
    # Start backend using main.py (production-ready with WebSocket support)
    cd "${PROJECT_DIR}/backend" && \
    source .venv/bin/activate && \
    export FLASK_ENV=development && \
    export FLASK_DEBUG=1 && \
    python -m app.main > "$LOG_BACKEND" 2>&1 &
    
    # Store the PID
    echo $! > "${PID_DIR}/backend.pid"
    
    # Wait for backend with health checks (5 seconds max, checking every 0.25 seconds)
    local retries=0
    while ! curl -s "http://localhost:5001/api/v1/health/status" >/dev/null && [ $retries -lt 20 ]; do
        sleep 0.25  # Check 4 times per second
        ((retries++))
        log "INFO" "Waiting for backend... ($retries/20)"
    done
    
    # Quick verification of backend health
    if [ $retries -lt 20 ]; then
        local health_status=$(curl -s "http://localhost:5001/api/v1/health/status")
        if [[ $health_status == *"\"websocket\":{\"status\":\"healthy\""* ]]; then
            log "SUCCESS" "Backend started successfully with WebSocket support"
            return 0
        else
            log "ERROR" "Backend started but WebSocket is not healthy"
            return 1
        fi
    else
        log "ERROR" "Backend failed to start within 5 seconds. Last few log lines:"
        tail -n 5 "$LOG_BACKEND" | while read -r line; do
            log "ERROR" "  $line"
        done
        return 1
    fi
}

# Start React development server and wait for it
start_react() {
    log "INFO" "Starting React development server..."
    
    # Ensure frontend port is free
    safe_clear_port 3001
    
    # Set environment variables
    export NODE_ENV=development
    export ELECTRON_START_URL=http://localhost:3001
    export ELECTRON_DISABLE_SECURITY_WARNINGS=true
    export PORT=3001  # Explicitly set port
    
    # Start React dev server
    cd "${PROJECT_DIR}/frontend" && \
    npm start > "$LOG_FRONTEND" 2>&1 &
    
    # Store the PID
    echo $! > "${PID_DIR}/react.pid"
    
    # Wait for React server with comprehensive health check
    local retries=0
    local max_retries=45  # Increased timeout for slower systems
    
    while [ $retries -lt $max_retries ]; do
        # Check if process is still running
        if ! kill -0 $(cat "${PID_DIR}/react.pid" 2>/dev/null) 2>/dev/null; then
            log "ERROR" "React server process died"
            return 1
        fi
        
        # Try multiple types of checks
        if curl -s http://localhost:3001 >/dev/null 2>&1; then
            # Additional verification - wait for webpack compilation
            if grep -q "Compiled successfully" "$LOG_FRONTEND" 2>/dev/null; then
                log "SUCCESS" "React server started and compiled successfully"
                # Extra wait to ensure full readiness
                sleep 2
                return 0
            fi
        fi
        
        sleep 1
        ((retries++))
        log "INFO" "Waiting for React server... ($retries/$max_retries)"
    done
    
    log "ERROR" "React server failed to start or compile. Check logs/frontend.log"
    return 1
}

# Start Electron app
start_electron() {
    log "INFO" "Starting Electron app..."
    
    # Verify React is actually ready
    if ! curl -s http://localhost:3001 >/dev/null 2>&1; then
        log "ERROR" "React server not ready. Cannot start Electron."
        return 1
    fi
    
    cd "${PROJECT_DIR}/frontend"
    
    # Set comprehensive environment variables
    export NODE_ENV=development
    export ELECTRON_START_URL=http://localhost:3001
    export ELECTRON_DISABLE_SECURITY_WARNINGS=true
    export ELECTRON_DEV=1
    
    # Use macOS-specific main for darwin with proper error handling
    if [[ "$(uname)" == "Darwin" ]]; then
        NODE_ENV=development \
        ELECTRON_START_URL=http://localhost:3001 \
        electron macos/main.js > "$LOG_ELECTRON" 2>&1 &
    else
        NODE_ENV=development \
        ELECTRON_START_URL=http://localhost:3001 \
        electron . > "$LOG_ELECTRON" 2>&1 &
    fi
    
    # Store the PID
    echo $! > "${PID_DIR}/electron.pid"
    
    # Enhanced waiting logic for Electron
    local retries=0
    local max_retries=20
    
    while [ $retries -lt $max_retries ]; do
        # Check if process is still running
        if ! kill -0 $(cat "${PID_DIR}/electron.pid" 2>/dev/null) 2>/dev/null; then
            log "ERROR" "Electron process died"
            return 1
        fi
        
        # Check for successful window creation
        if grep -q "Window ready to show" "$LOG_ELECTRON" 2>/dev/null; then
            log "SUCCESS" "Electron app started successfully"
            return 0
        fi
        
        # Check for common errors
        if grep -q "Failed to fetch|ERR_CONNECTION_REFUSED" "$LOG_ELECTRON" 2>/dev/null; then
            log "ERROR" "Electron failed to connect to React server"
            return 1
        fi
        
        sleep 1
        ((retries++))
        log "INFO" "Waiting for Electron app... ($retries/$max_retries)"
    done
    
    log "ERROR" "Electron app failed to start. Check logs/electron.log"
    return 1
}

# Start all services in sequence
start_services() {
    log "INFO" "Starting MAM services..."
    
    # First verify all required dependencies
    local missing_deps=0
    
    # Check Node.js version
    if ! node -v >/dev/null 2>&1; then
        log "ERROR" "Node.js is not installed"
        missing_deps=1
    fi
    
    # Check npm
    if ! npm -v >/dev/null 2>&1; then
        log "ERROR" "npm is not installed"
        missing_deps=1
    fi
    
    # Check Python
    if ! python3 --version >/dev/null 2>&1; then
        log "ERROR" "Python 3 is not installed"
        missing_deps=1
    fi
    
    # Exit if dependencies are missing
    if [ $missing_deps -eq 1 ]; then
        log "ERROR" "Missing required dependencies. Please install them first."
        return 1
    fi
    
    # Stop any existing services first
    stop_services
    
    # Start backend and wait for it
    start_backend || (
        log "ERROR" "Failed to start backend"
        stop_services
        return 1
    )
    
    # Start React and wait for it to be fully ready
    start_react || (
        log "ERROR" "Failed to start React server"
        stop_services
        return 1
    )
    
    # Extra verification step for React
    if ! curl -s http://localhost:3001 >/dev/null 2>&1; then
        log "ERROR" "React server not responding after startup"
        stop_services
        return 1
    fi
    
    # Finally start Electron
    start_electron || (
        log "ERROR" "Failed to start Electron"
        stop_services
        return 1
    )
    
    log "SUCCESS" "All services started successfully"
    return 0
}

# Check service status
check_status() {
    local status=0
    
    # Check backend with improved error handling
    local health_response
    local status_code
    
    # First check if backend port is even listening
    if ! lsof -i:5001 -sTCP:LISTEN >/dev/null 2>&1; then
        log "ERROR" "Backend is not running (port 5001 not listening)"
        status=1
    else
        # Try to get health status with timeout
        health_response=$(curl -s -m 5 "http://localhost:5001/api/v1/health/status")
        if [ $? -eq 0 ] && [ -n "$health_response" ]; then
            # Use jq to parse the JSON response
            if echo "$health_response" | jq -e '.status == "healthy"' >/dev/null; then
                log "SUCCESS" "Backend is running"
                # WebSocket is part of the backend now
                log "SUCCESS" "WebSocket is running (integrated with backend)"
            else
                log "ERROR" "Backend reports unhealthy status"
                status=1
            fi
        else
            log "ERROR" "Backend health check failed"
            status=1
        fi
    fi
    
    # Check React server with improved port check
    if ! lsof -i:3001 -sTCP:LISTEN >/dev/null 2>&1; then
        log "ERROR" "React server is not running (port 3001 not listening)"
        status=1
    else
        # Try to connect to React server
        if curl -s -m 5 "http://localhost:3001" >/dev/null 2>&1; then
            log "SUCCESS" "React server is running"
        else
            log "ERROR" "React server is not responding"
            status=1
        fi
    fi
    
    # Check Electron with improved process detection
    local electron_pids=$(pgrep -f "electron.*${PROJECT_DIR}/frontend" || true)
    if [ -n "$electron_pids" ]; then
        # Count running instances
        local running_count=0
        for pid in $electron_pids; do
            if ps -p "$pid" >/dev/null 2>&1; then
                ((running_count++))
            fi
        done
        if [ "$running_count" -gt 0 ]; then
            log "SUCCESS" "Electron is running ($running_count instance(s))"
        else
            log "ERROR" "No valid Electron processes found"
            status=1
        fi
    else
        log "ERROR" "Electron is not running"
        status=1
    fi
    
    return $status
}

# Main command handler
case "$1" in
    start)
        log "INFO" "Starting MAM services..."
        # Only stop once at the beginning
        if ! stop_services; then
            log "ERROR" "Failed to stop existing services"
            exit 1
        fi
        
        # Start backend first
        if ! start_backend; then
            log "ERROR" "Failed to start backend - stopping all services"
            stop_services
            exit 1
        fi
        
        # Only proceed to React if backend is running
        if ! start_react; then
            log "ERROR" "Failed to start React - stopping all services"
            stop_services
            exit 1
        fi
        
        # Only proceed to Electron if React is running
        if ! start_electron; then
            log "ERROR" "Failed to start Electron - stopping all services"
            stop_services
            exit 1
        fi
        
        log "SUCCESS" "All services started successfully"
        ;;
    stop)
        stop_services
        ;;
    restart)
        log "INFO" "Restarting all services..."
        if ! stop_services; then
            log "ERROR" "Failed to stop services cleanly"
            exit 1
        fi
        
        sleep 2
        
        if ! start_services; then
            log "ERROR" "Service restart failed"
            exit 1
        fi
        
        # Verify all services are actually running
        if ! check_status; then
            log "ERROR" "Service verification failed after restart"
            exit 1
        fi
        
        log "SUCCESS" "All services restarted successfully"
        ;;
    status)
        check_status
        ;;
    logs)
        # Show logs in split view with React logs
        tmux new-session \
            "tail -f $LOG_BACKEND" \; \
            split-window -h "tail -f $LOG_FRONTEND" \; \
            split-window -v "tail -f $LOG_ELECTRON" \; \
            select-layout main-vertical
        ;;
    *)
        cat << EOF
MAM Application Launcher v1.0.4

Usage: $(basename "$0") COMMAND

Commands:
  start   - Start all services
  stop    - Stop all services
  restart - Restart all services
  status  - Check service status
  logs    - View all logs (requires tmux)

Services:
  - Backend API (Flask)   : :5001 (includes WebSocket)
  - Electron App         : :3001

Logs:
  - Backend  : logs/backend.log
  - Electron : logs/electron.log
  - Launcher : logs/launcher.log
EOF
        ;;
esac

exit 0 