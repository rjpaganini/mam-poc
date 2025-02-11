#!/bin/bash

# manage_services.sh
# Script to manage MAM application services
# Author: Claude
# Date: 2024-02-07
# Version: 1.0.3

set -e  # Exit on error

# Get the absolute paths
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Setup logging
LOG_DIR="${PROJECT_ROOT}/logs"
LOG_FILE="${LOG_DIR}/services.log"
PID_DIR="${PROJECT_ROOT}/pids"
mkdir -p "$LOG_DIR" "$PID_DIR"

# Environment setup
VENV_PATH="${PROJECT_ROOT}/backend/.venv"
PYTHON="${VENV_PATH}/bin/python3"
PIP="${VENV_PATH}/bin/pip"
BACKEND_PORT=${BACKEND_PORT:-5001}
FRONTEND_PORT=${FRONTEND_PORT:-3001}
WEBSOCKET_PORT=${WEBSOCKET_PORT:-3002}  # WebSocket port for development
SCRIPT_VERSION="1.0.3"

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

activate_venv() {
    if [ -n "${VIRTUAL_ENV}" ] && [ "${VIRTUAL_ENV}" = "${VENV_PATH}" ]; then
        log "INFO" "Already in correct virtual environment: ${VIRTUAL_ENV}"
        return 0
    fi
    
    if [ -f "${VENV_PATH}/bin/activate" ]; then
        if [ -n "${VIRTUAL_ENV}" ] && [ "${VIRTUAL_ENV}" != "${VENV_PATH}" ]; then
            deactivate 2>/dev/null || true
        fi
        
        source "${VENV_PATH}/bin/activate"
        CURRENT_PYTHON=$(which python3)
        
        if [[ "$CURRENT_PYTHON" != "${VENV_PATH}/bin/python3" ]]; then
            log "ERROR" "Wrong Python interpreter active: ${CURRENT_PYTHON}"
            return 1
        fi
        
        log "SUCCESS" "Virtual environment activated: ${VENV_PATH}"
        return 0
    fi
    
    log "ERROR" "Virtual environment not found at ${VENV_PATH}"
    return 1
}

check_dependencies() {
    log "INFO" "Checking dependencies..."
    
    if [ ! -d "${VENV_PATH}" ]; then
        log "WARN" "Virtual environment not found. Running consolidate_venv.sh..."
        "${PROJECT_ROOT}/scripts/consolidate_venv.sh"
        activate_venv
        return
    fi
    
    activate_venv
    
    local missing=0
    local required=("flask" "flask-cors" "flask-sock" "flask-sqlalchemy")
    
    for pkg in "${required[@]}"; do
        if ! "${PIP}" list | grep -i "^$pkg" > /dev/null; then
            log "WARN" "Missing package: $pkg"
            missing=1
        fi
    done
    
    if [ $missing -eq 1 ]; then
        log "WARN" "Missing required packages. Running consolidate_venv.sh..."
        deactivate 2>/dev/null || true
        "${PROJECT_ROOT}/scripts/consolidate_venv.sh"
        activate_venv
    else
        log "SUCCESS" "All dependencies are installed"
    fi
}

# Function to check if a PID is a descendant of another PID
is_descendant_of() {
    local pid=$1
    local parent_pid=$2
    local current_pid=$pid
    
    while [ "$current_pid" != "1" ] && [ -n "$current_pid" ]; do
        if [ "$current_pid" = "$parent_pid" ]; then
            return 0
        fi
        current_pid=$(ps -o ppid= -p "$current_pid" | tr -d ' ')
    done
    return 1
}

# Function to check port availability
check_port_availability() {
    local port=$1
    local service=$2
    
    # If port is not in use, it's available
    if ! lsof -i ":$port" >/dev/null 2>&1; then
        return 0
    fi
    
    # For initial health check, just check if port is in use
    if [ "${INITIAL_CHECK:-0}" = "1" ]; then
        log "ERROR" "Port $port is in use"
        return 1
    fi
    
    # For service verification, check if our service is responding
    if [ "$service" = "frontend" ]; then
        if curl -s "http://localhost:$port" >/dev/null; then
            return 0
        fi
    elif [ "$service" = "backend" ]; then
        if curl -s "http://localhost:$port/api/v1/health/status" >/dev/null; then
            return 0
        fi
    elif [ "$service" = "websocket" ]; then
        # WebSocket check - just verify port is in use by our process
        local pid=$(lsof -ti:$port)
        if [ -n "$pid" ] && is_descendant_of "$pid" "$$"; then
            return 0
        fi
    fi
    
    log "ERROR" "Service on port $port is not responding"
    return 1
}

# Enhanced health check system
check_system_health() {
    local status=0
    local -a errors=()
    
    log "INFO" "Performing comprehensive health check..."
    
    # 1. Check disk space
    local disk_usage
    disk_usage=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 90 ]; then
        errors+=("Disk usage critical: ${disk_usage}%")
        status=1
    fi
    
    # 2. Check memory
    if command -v free >/dev/null 2>&1; then
        local mem_usage
        mem_usage=$(free | awk '/Mem:/ {printf("%.0f", $3/$2 * 100)}')
        if [ "$mem_usage" -gt 90 ]; then
            errors+=("Memory usage critical: ${mem_usage}%")
            status=1
        fi
    fi
    
    # 3. Check port availability
    check_port_availability "$BACKEND_PORT" "backend"
    check_port_availability "$FRONTEND_PORT" "frontend"
    
    # 4. Check Python environment
    if ! command -v python3 >/dev/null 2>&1; then
        errors+=("Python3 not found")
        status=1
    else
        local python_version
        python_version=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
        local major_version=$(echo "$python_version" | cut -d. -f1)
        local minor_version=$(echo "$python_version" | cut -d. -f2)
        
        if [ "$major_version" -lt 3 ] || ([ "$major_version" -eq 3 ] && [ "$minor_version" -lt 11 ]); then
            errors+=("Python version must be >= 3.11 (found $python_version)")
            status=1
        fi
    fi
    
    # 5. Check Node.js environment
    if ! command -v node >/dev/null 2>&1; then
        errors+=("Node.js not found")
        status=1
    else
        local node_version
        node_version=$(node -v | cut -d'v' -f2)
        local node_major=$(echo "$node_version" | cut -d. -f1)
        
        if [ "$node_major" -lt 18 ]; then
            errors+=("Node.js version must be >= 18.0 (found $node_version)")
            status=1
        fi
    fi
    
    # 6. Check required directories
    for dir in "backend" "frontend" "logs" "pids"; do
        if [ ! -d "$PROJECT_ROOT/$dir" ]; then
            errors+=("Required directory not found: $dir")
            status=1
        fi
    done
    
    # 7. Check virtual environment
    if [ ! -f "${VENV_PATH}/bin/activate" ]; then
        errors+=("Virtual environment not found at ${VENV_PATH}")
        status=1
    fi
    
    # 8. Verify running processes
    if [ -f "${PID_DIR}/backend.pid" ] || [ -f "${PID_DIR}/frontend.pid" ]; then
        verify_own_process "${PID_DIR}/backend.pid" "Backend"
        verify_own_process "${PID_DIR}/frontend.pid" "Frontend"
    fi
    
    # Report results
    if [ $status -eq 0 ]; then
        log "SUCCESS" "Health check passed"
    else
        log "ERROR" "Health check failed:"
        for error in "${errors[@]}"; do
            log "ERROR" "  - $error"
        done
    fi
    
    return $status
}

# Add function to verify our own processes
verify_own_process() {
    local pid_file=$1
    local process_name=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ! ps -p "$pid" > /dev/null; then
            errors+=("$process_name process (PID: $pid) is not running")
            status=1
            return 1
        fi
    fi
    return 0
}

start_backend() {
    log "INFO" "Starting backend service..."
    
    # Check if backend is already running
    if is_backend_running; then
        log "WARN" "Backend service is already running"
        return 1
    }
    
    # Activate virtual environment and start backend
    source "${VENV_PATH}/bin/activate"
    cd "${PROJECT_ROOT}/backend" || exit 1
    
    # Start backend with main.py (production server with WebSocket support)
    nohup python -m app.main > "${LOG_DIR}/backend.log" 2>&1 &
    BACKEND_PID=$!
    
    # Store PID
    echo "${BACKEND_PID}" > "${PID_DIR}/backend.pid"
    
    # Wait for backend to start
    sleep 2
    if ! is_backend_running; then
        log "ERROR" "Failed to start backend service"
        return 1
    fi
    
    log "SUCCESS" "Backend service started (PID: ${BACKEND_PID})"
    return 0
}

start() {
    log "INFO" "Starting services..."
    
    # First, ensure everything is stopped
    stop
    sleep 2
    
    # Initial port check
    INITIAL_CHECK=1
    if ! check_port_availability "$BACKEND_PORT" "backend" || \
       ! check_port_availability "$FRONTEND_PORT" "frontend" || \
       ! check_port_availability "$WEBSOCKET_PORT" "websocket"; then
        log "ERROR" "Required ports are in use - aborting startup"
        return 1
    fi
    unset INITIAL_CHECK
    
    # Start backend (which includes WebSocket)
    start_backend
    
    # Start frontend with specific WebSocket port
    cd "${PROJECT_ROOT}/frontend" || return 1
    PORT=$FRONTEND_PORT WDS_SOCKET_PORT=$WEBSOCKET_PORT BROWSER=none npm start > "${LOG_DIR}/frontend.log" 2>&1 &
    echo $! > "${PID_DIR}/frontend.pid"
    
    # Wait for frontend
    retries=0
    while ! curl -s "http://localhost:${FRONTEND_PORT}" >/dev/null && [ $retries -lt 60 ]; do
        sleep 1
        ((retries++))
        log "INFO" "Waiting for frontend... ($retries/60)"
    done
    
    if [ $retries -eq 60 ]; then
        log "ERROR" "Frontend failed to start"
        stop
        return 1
    fi
    
    log "SUCCESS" "All services started"
    log "INFO" "Backend: http://localhost:$BACKEND_PORT"
    log "INFO" "Frontend: http://localhost:$FRONTEND_PORT"
    log "INFO" "WebSocket: ws://localhost:$WEBSOCKET_PORT"
    return 0
}

verify_services() {
    local status=0
    
    if ! curl -s http://localhost:$BACKEND_PORT/api/v1/health/status >/dev/null; then
        log "ERROR" "Backend service not responding on port $BACKEND_PORT"
        status=1
    fi
    
    if ! curl -s http://localhost:$FRONTEND_PORT >/dev/null; then
        log "ERROR" "Frontend service not responding on port $FRONTEND_PORT"
        status=1
    fi
    
    if [ $status -eq 0 ]; then
        log "SUCCESS" "All services verified"
        log "INFO" "Backend: http://localhost:$BACKEND_PORT"
        log "INFO" "Frontend: http://localhost:$FRONTEND_PORT"
    fi
    
    return $status
}

stop() {
    log "INFO" "Stopping services..."
    
    # Kill processes by port first (more reliable)
    for port in $BACKEND_PORT $FRONTEND_PORT $WEBSOCKET_PORT; do
        if lsof -ti:$port >/dev/null 2>&1; then
            log "INFO" "Killing process on port $port"
            lsof -ti:$port | xargs kill -15 2>/dev/null || \
            lsof -ti:$port | xargs kill -9 2>/dev/null || true
        fi
    done
    
    # Then clean up any stragglers by PID file
    for pid_file in "${PID_DIR}"/*.pid; do
        if [ -f "$pid_file" ]; then
            pid=$(cat "$pid_file")
            if ps -p "$pid" > /dev/null 2>&1; then
                log "INFO" "Killing process $pid from $pid_file"
                kill -15 "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
            fi
            rm -f "$pid_file"
        fi
    done
    
    # Final cleanup of any remaining related processes
    pkill -15 -f "python.*${PROJECT_ROOT}/backend" 2>/dev/null || \
    pkill -9 -f "python.*${PROJECT_ROOT}/backend" 2>/dev/null || true
    
    pkill -15 -f "node.*${PROJECT_ROOT}/frontend" 2>/dev/null || \
    pkill -9 -f "node.*${PROJECT_ROOT}/frontend" 2>/dev/null || true
    
    # Give processes time to clean up
    sleep 2
    
    # Verify all ports are free
    local all_stopped=true
    for port in $BACKEND_PORT $FRONTEND_PORT $WEBSOCKET_PORT; do
        if lsof -i ":$port" >/dev/null 2>&1; then
            log "ERROR" "Failed to stop process on port $port"
            all_stopped=false
        fi
    done
    
    if [ "$all_stopped" = true ]; then
        log "SUCCESS" "All services stopped"
    else
        log "ERROR" "Some services failed to stop"
        return 1
    fi
    
    deactivate 2>/dev/null || true
}

case "$1" in
    start)      start ;;
    stop)       stop ;;
    restart)    
        stop
        sleep 2
        start
        ;;
    status)     verify_services ;;
    *)          echo "Usage: $0 {start|stop|restart|status}" && exit 1 ;;
esac

exit 0 