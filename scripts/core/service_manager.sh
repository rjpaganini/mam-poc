#!/usr/bin/env bash

# service_manager.sh
# Core service management functionality for MAM application
# Author: Senior Developer
# Version: 2.2.1
# Last Updated: 2024-02-13

# Strict error handling
set -euo pipefail

# Ensure we're running in bash
if [ -z "${BASH_VERSION:-}" ]; then
    exec /bin/bash "$0" "$@"
fi

# Debug mode if requested
if [ "${DEBUG:-0}" = "1" ]; then
    set -x
fi

# Ensure consistent environment
export LC_ALL=C
export LANG=C

# Determine script location regardless of shell
get_script_dir() {
    local source="${BASH_SOURCE[0]}"
    while [ -h "$source" ]; do
        local dir="$( cd -P "$( dirname "$source" )" && pwd )"
        source="$(readlink "$source")"
        [[ $source != /* ]] && source="$dir/$source"
    done
    echo "$( cd -P "$( dirname "$source" )" && pwd )"
}

SCRIPT_DIR=$(get_script_dir)
export PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Verify PROJECT_ROOT exists and is a directory
if [ ! -d "$PROJECT_ROOT" ]; then
    echo "ERROR: PROJECT_ROOT ($PROJECT_ROOT) is not a valid directory"
    exit 1
fi

cd "$PROJECT_ROOT" || exit 1

# Configuration
LOG_DIR="${PROJECT_ROOT}/logs"
PID_DIR="${PROJECT_ROOT}/pids"
VENV_DIR="${PROJECT_ROOT}/backend/.venv"
PYTHON="${VENV_DIR}/bin/python"

# Service ports
BACKEND_PORT="5001"
FRONTEND_PORT="3001"

# Service state management using simple variables instead of associative array
BACKEND_STATE="STOPPED"
FRONTEND_STATE="STOPPED"
ELECTRON_STATE="STOPPED"

# State management functions
update_service_state() {
    local service=$1
    local new_state=$2
    local old_state
    
    # Get current state
    case $service in
        "backend")
            old_state=$BACKEND_STATE
            ;;
        "frontend")
            old_state=$FRONTEND_STATE
            ;;
        "electron")
            old_state=$ELECTRON_STATE
            ;;
        *)
            log "ERROR" "Unknown service: $service"
            return 1
            ;;
    esac
    
    # Validate state transition
    case $old_state in
        "STOPPED")
            [[ "$new_state" == "STARTING" ]] || return 1
            ;;
        "STARTING")
            [[ "$new_state" == "INITIALIZING" || "$new_state" == "FAILED" ]] || return 1
            ;;
        "INITIALIZING")
            [[ "$new_state" == "READY" || "$new_state" == "FAILED" ]] || return 1
            ;;
        "READY")
            [[ "$new_state" == "SERVING" || "$new_state" == "FAILED" ]] || return 1
            ;;
        "SERVING")
            [[ "$new_state" == "STOPPED" || "$new_state" == "FAILED" ]] || return 1
            ;;
        "FAILED")
            [[ "$new_state" == "STOPPED" ]] || return 1
            ;;
    esac
    
    # Update state
    case $service in
        "backend")
            BACKEND_STATE=$new_state
            ;;
        "frontend")
            FRONTEND_STATE=$new_state
            ;;
        "electron")
            ELECTRON_STATE=$new_state
            ;;
    esac
    
    log "INFO" "Service $service state changed: $old_state -> $new_state"
    return 0
}

get_service_state() {
    local service=$1
    case $service in
        "backend")
            echo "$BACKEND_STATE"
            ;;
        "frontend")
            echo "$FRONTEND_STATE"
            ;;
        "electron")
            echo "$ELECTRON_STATE"
            ;;
        *)
            log "ERROR" "Unknown service: $service"
            return 1
            ;;
    esac
}

# Enhanced readiness checks
check_frontend_readiness() {
    local max_retries=${1:-60}  # Default 60 retries (15 seconds)
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        # Check 1: Process is running
        if [ ! -f "${PID_DIR}/frontend.pid" ]; then
            log "WARN" "Frontend PID file not found"
            return 1
        fi
        
        local pid=$(cat "${PID_DIR}/frontend.pid")
        if ! kill -0 "$pid" 2>/dev/null; then
            log "WARN" "Frontend process not running"
            return 1
        fi
        
        # Check 2: Webpack compilation - now handles both success and warnings
        if ! grep -q "Compiled successfully\|Compiled with warnings" "${LOG_DIR}/frontend.log" 2>/dev/null; then
            log "INFO" "Waiting for webpack compilation... ($retry_count/$max_retries)"
            sleep 0.25
            ((retry_count++))
            continue
        fi
        
        # Check 3: Port binding
        if ! lsof -i :$FRONTEND_PORT -P -n 2>/dev/null | grep -q LISTEN; then
            log "INFO" "Waiting for port binding... ($retry_count/$max_retries)"
            sleep 0.25
            ((retry_count++))
            continue
        fi
        
        # Check 4: HTTP response
        local http_code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${FRONTEND_PORT}")
        if [ "$http_code" != "200" ]; then
            log "INFO" "Waiting for HTTP server... ($retry_count/$max_retries)"
            sleep 0.25
            ((retry_count++))
            continue
        fi
        
        # Check 5: WebSocket server
        if ! grep -q "WebSocket server is running" "${LOG_DIR}/frontend.log" 2>/dev/null; then
            log "INFO" "Waiting for WebSocket server... ($retry_count/$max_retries)"
            sleep 0.25
            ((retry_count++))
            continue
        fi
        
        # All checks passed
        return 0
    done
    
    log "ERROR" "Frontend readiness check timed out after $max_retries retries"
    return 1
}

check_backend_readiness() {
    local max_retries=${1:-60}  # Default 60 retries (15 seconds)
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        # Check 1: Process is running
        if [ ! -f "${PID_DIR}/backend.pid" ]; then
            log "WARN" "Backend PID file not found"
            return 1
        fi
        
        local pid=$(cat "${PID_DIR}/backend.pid")
        if ! kill -0 "$pid" 2>/dev/null; then
            log "WARN" "Backend process not running"
            return 1
        fi
        
        # Check 2: Port binding
        if ! lsof -i :$BACKEND_PORT -P -n 2>/dev/null | grep -q LISTEN; then
            log "INFO" "Waiting for port binding... ($retry_count/$max_retries)"
            sleep 0.25
            ((retry_count++))
            continue
        fi
        
        # Check 3: Health check endpoint
        local health_status=$(curl -s "http://127.0.0.1:${BACKEND_PORT}/api/v1/health/status" 2>/dev/null)
        if [ -z "$health_status" ]; then
            log "INFO" "Waiting for health check... ($retry_count/$max_retries)"
            sleep 0.25
            ((retry_count++))
            continue
        fi
        
        # All checks passed
        return 0
    done
    
    log "ERROR" "Backend readiness check timed out after $max_retries retries"
    return 1
}

verify_service_dependencies() {
    local service=$1
    
    case $service in
        "electron")
            # Electron requires frontend to be SERVING
            if [ "$(get_service_state "frontend")" != "SERVING" ]; then
                log "ERROR" "Frontend service must be in SERVING state before starting Electron"
                return 1
            fi
            ;;
        "frontend")
            # Frontend requires backend to be SERVING
            if [ "$(get_service_state "backend")" != "SERVING" ]; then
                log "ERROR" "Backend service must be in SERVING state before starting Frontend"
                return 1
            fi
            ;;
    esac
    
    return 0
}

# List of all services in dependency order
SERVICES=("backend" "frontend")

# Create required directories with proper permissions
mkdir -p "$LOG_DIR" "$PID_DIR"
chmod 755 "$LOG_DIR" "$PID_DIR"

# Source other core utilities using relative path
ENV_MANAGER="${SCRIPT_DIR}/env_manager.sh"
if [ ! -f "$ENV_MANAGER" ]; then
    echo "ERROR: env_manager.sh not found at $ENV_MANAGER"
    exit 1
fi
source "$ENV_MANAGER"

# Enhanced logging with timestamps and process info
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local pid=$$
    local parent_pid=$PPID
    
    # Create log message with process information
    local log_message="${timestamp} [${level}] [PID:${pid}/PPID:${parent_pid}] ${message}"
    
    # Write to log file
    echo "${log_message}" >> "${LOG_DIR}/service_manager.log"
    
    # Terminal output with colors
    case $level in
        "ERROR")   echo -e "\033[0;31m${log_message}\033[0m" ;;
        "SUCCESS") echo -e "\033[0;32m${log_message}\033[0m" ;;
        "WARN")    echo -e "\033[1;33m${log_message}\033[0m" ;;
        "INFO")    echo -e "\033[0;34m${log_message}\033[0m" ;;
        "DEBUG")   echo -e "\033[0;37m${log_message}\033[0m" ;;
    esac
}

# Pre-flight checks
check_dependencies() {
    log "INFO" "Checking dependencies..."
    
    # Check Python version
    if ! command -v python3 >/dev/null; then
        log "ERROR" "Python 3 is required but not installed"
        return 1
    fi
    
    # Check Node.js
    if ! command -v node >/dev/null; then
        log "ERROR" "Node.js is required but not installed"
        return 1
    fi
    
    # Check npm
    if ! command -v npm >/dev/null; then
        log "ERROR" "npm is required but not installed"
        return 1
    fi
    
    log "SUCCESS" "All dependencies found"
    return 0
}

# Enhanced port management
get_port_info() {
    local port=$1
    local info
    info=$(lsof -i ":${port}" -P -n 2>/dev/null)
    echo "$info"
}

# Enhanced port checking with retries
check_port() {
    local port=$1
    local service=$2
    local retries=3
    local wait=1
    
    while [[ $retries -gt 0 ]]; do
        if ! lsof -i ":$port" >/dev/null 2>&1; then
            log "INFO" "Port $port is available"
            return 0
        fi
        
        log "INFO" "Port $port in use, waiting ${wait}s... ($retries retries left)"
        sleep $wait
        retries=$((retries - 1))
    done
    
    log "WARN" "$service port $port already in use"
    return 1
}

cleanup_stale_service() {
    local service=$1
    local port=$(get_port "$service")
    
    # Check for stale PID file
    if [ -f "${PID_DIR}/${service}.pid" ]; then
        local pid=$(cat "${PID_DIR}/${service}.pid")
        if ! kill -0 "$pid" 2>/dev/null; then
            log "WARN" "Found stale PID file for $service"
            rm -f "${PID_DIR}/${service}.pid"
        fi
    fi
    
    # Check for orphaned processes on the port
    local port_info
    port_info=$(get_port_info "$port")
    if [ -n "$port_info" ]; then
        local pid=$(echo "$port_info" | tail -n 1 | awk '{print $2}')
        log "WARN" "Found orphaned process on port $port (PID: $pid)"
        safe_kill "$pid" "$service"
    fi
}

# Improved process management
safe_kill() {
    local pid=$1
    local service=$2
    
    if ! kill -0 "$pid" 2>/dev/null; then
        log "INFO" "Process $pid not running"
        return 0
    fi
    
    log "INFO" "Stopping $service (PID: $pid)..."
    kill "$pid" 2>/dev/null || true
    
    # Wait for process to stop
    local wait=5
    while kill -0 "$pid" 2>/dev/null && [[ $wait -gt 0 ]]; do
        sleep 1
        wait=$((wait - 1))
    done
    
    if kill -0 "$pid" 2>/dev/null; then
        log "WARN" "$service still running, force killing..."
        kill -9 "$pid" 2>/dev/null || true
    else
        log "SUCCESS" "$service stopped gracefully"
    fi
}

# Service management functions
start_backend() {
    log "INFO" "Starting backend service..."
    
    # Update state to STARTING
    if ! update_service_state "backend" "STARTING"; then
        log "ERROR" "Invalid state transition to STARTING for backend"
        return 1
    fi
    
    # Check if port is available
    if ! check_port "$BACKEND_PORT" "backend"; then
        update_service_state "backend" "FAILED"
        return 1
    fi
    
    # Start the backend service
    cd "${PROJECT_ROOT}/backend"
    
    # Update state to INITIALIZING
    update_service_state "backend" "INITIALIZING"
    
    "${PYTHON}" -m app.main > "${LOG_DIR}/backend.log" 2>&1 &
    local pid=$!
    echo $pid > "${PID_DIR}/backend.pid"
    
    # Wait for backend readiness
    if ! check_backend_readiness 60; then
        log "ERROR" "Backend failed readiness check"
        update_service_state "backend" "FAILED"
        cd "$PROJECT_ROOT"
        return 1
    fi
    
    # Update state to READY
    update_service_state "backend" "READY"
    
    # Final health check before marking as SERVING
    if curl -s "http://127.0.0.1:${BACKEND_PORT}/api/v1/health/status" >/dev/null 2>&1; then
        update_service_state "backend" "SERVING"
        log "SUCCESS" "Backend started and serving on port $BACKEND_PORT"
        cd "$PROJECT_ROOT"
        return 0
    else
        log "ERROR" "Backend health check failed"
        update_service_state "backend" "FAILED"
        cd "$PROJECT_ROOT"
        return 1
    fi
}

# Enhanced process verification
is_our_process() {
    local pid=$1
    local process_cmd
    process_cmd=$(ps -p "$pid" -o command= 2>/dev/null)
    [[ "$process_cmd" == *"${PROJECT_ROOT}"* ]] && return 0
    return 1
}

# Enhanced process tree killing
get_child_pids() {
    local parent_pid=$1
    pgrep -P "$parent_pid" | while read -r pid; do
        echo "$pid"
        get_child_pids "$pid"
    done
}

kill_process_tree() {
    local pattern=$1
    local force=${2:-0}
    
    # Find all matching parent processes
    local pids
    pids=$(pgrep -f "$pattern" || true)
    
    if [ -n "$pids" ]; then
        for pid in $pids; do
            # Get all child PIDs
            local all_pids="$pid $(get_child_pids "$pid")"
            
            # Try graceful shutdown first
            if [ "$force" -eq 0 ]; then
                log "INFO" "Gracefully stopping process tree for PID: $pid"
                for p in $all_pids; do
                    kill -TERM "$p" 2>/dev/null || true
                done
                
                # Wait for processes to stop
                local retries=0
                while [ $retries -lt 5 ]; do
                    local all_dead=1
                    for p in $all_pids; do
                        if kill -0 "$p" 2>/dev/null; then
                            all_dead=0
                            break
                        fi
                    done
                    
                    if [ $all_dead -eq 1 ]; then
                        break
                    fi
                    
                    sleep 1
                    ((retries++))
                done
            fi
            
            # Force kill if still running
            for p in $all_pids; do
                if kill -0 "$p" 2>/dev/null; then
                    log "WARN" "Force killing process: $p"
                    kill -9 "$p" 2>/dev/null || true
                fi
            done
        done
    fi
}

# Enhanced Electron management
kill_electron() {
    log "INFO" "Stopping Electron app..."
    
    # Define process patterns
    local patterns=(
        "electron.*${PROJECT_ROOT}/frontend"
        "node.*${PROJECT_ROOT}/frontend/node_modules/.bin/electron"
        "node.*${PROJECT_ROOT}/frontend/node_modules/.bin/cross-env.*electron"
    )
    
    # Kill each process tree
    for pattern in "${patterns[@]}"; do
        kill_process_tree "$pattern"
    done
    
    # Verify all processes are stopped
    local all_stopped=1
    for pattern in "${patterns[@]}"; do
        if pgrep -f "$pattern" > /dev/null; then
            all_stopped=0
            log "ERROR" "Failed to stop processes matching: $pattern"
        fi
    done
    
    # Clean up PID file
    rm -f "${PID_DIR}/electron.pid"
    
    if [ $all_stopped -eq 1 ]; then
        log "SUCCESS" "Electron app and all related processes stopped"
        return 0
    else
        log "ERROR" "Failed to stop some Electron processes"
        return 1
    fi
}

# Enhanced Electron startup
start_electron() {
    log "INFO" "Starting Electron app..."
    
    # Update state to STARTING
    if ! update_service_state "electron" "STARTING"; then
        log "ERROR" "Invalid state transition to STARTING for electron"
        return 1
    fi
    
    # Verify frontend dependency
    if ! verify_service_dependencies "electron"; then
        update_service_state "electron" "FAILED"
        return 1
    fi
    
    # Kill any existing Electron instances
    kill_electron
    
    cd "${PROJECT_ROOT}/frontend"
    
    # Update state to INITIALIZING
    update_service_state "electron" "INITIALIZING"
    
    # Enhanced environment setup
    export ELECTRON_START_URL="http://127.0.0.1:${FRONTEND_PORT}"
    export NODE_ENV=development
    export ELECTRON_STARTUP_TIMEOUT=30000
    export DEBUG=electron:*
    export ELECTRON_ENABLE_LOGGING=true
    export ELECTRON_ENABLE_STACK_DUMPING=true
    
    log "INFO" "Starting Electron with configuration:"
    log "INFO" "  ELECTRON_START_URL: $ELECTRON_START_URL"
    log "INFO" "  NODE_ENV: $NODE_ENV"
    log "INFO" "  ELECTRON_STARTUP_TIMEOUT: $ELECTRON_STARTUP_TIMEOUT"
    
    # Start Electron with enhanced logging
    npm run electron-dev > "${LOG_DIR}/electron.log" 2>&1 &
    
    local pid=$!
    echo $pid > "${PID_DIR}/electron.pid"
    
    # Enhanced startup verification
    local retries=0
    while [ $retries -lt 120 ]; do
        # Check if process is still running
        if ! kill -0 $pid 2>/dev/null; then
            log "ERROR" "Electron process died during startup"
            update_service_state "electron" "FAILED"
            return 1
        fi
        
        # Check for successful window creation
        if grep -q "Creating window in development mode" "${LOG_DIR}/electron.log" 2>/dev/null; then
            log "INFO" "Electron window creation detected"
            update_service_state "electron" "READY"
            
            # Check for connection errors
            if grep -q "ERR_CONNECTION_REFUSED" "${LOG_DIR}/electron.log" 2>/dev/null; then
                log "WARN" "Connection refused to frontend, retrying..."
            else
                # Additional verification
                sleep 2
                if ! grep -q "ERR_CONNECTION_REFUSED" "${LOG_DIR}/electron.log" 2>/dev/null; then
                    update_service_state "electron" "SERVING"
                    log "SUCCESS" "Electron started and connected successfully"
                    cd "$PROJECT_ROOT"
                    return 0
                fi
            fi
        fi
        
        sleep 0.25
        ((retries++))
        log "INFO" "Waiting for Electron startup... ($retries/120)"
        
        # Check for specific errors
        if grep -q "Failed to load URL" "${LOG_DIR}/electron.log" 2>/dev/null; then
            log "ERROR" "Electron failed to load frontend URL"
            update_service_state "electron" "FAILED"
            cd "$PROJECT_ROOT"
            return 1
        fi
    done
    
    log "ERROR" "Electron failed to start within 30 seconds"
    update_service_state "electron" "FAILED"
    cd "$PROJECT_ROOT"
    return 1
}

start_frontend() {
    log "INFO" "Starting frontend service..."
    
    # Update state to STARTING
    if ! update_service_state "frontend" "STARTING"; then
        log "ERROR" "Invalid state transition to STARTING for frontend"
        return 1
    fi
    
    # Verify backend dependency
    if ! verify_service_dependencies "frontend"; then
        update_service_state "frontend" "FAILED"
        return 1
    fi
    
    # Check if port is available
    if ! check_port "$FRONTEND_PORT" "frontend"; then
        update_service_state "frontend" "FAILED"
        return 1
    fi
    
    # Start the React development server
    cd "${PROJECT_ROOT}/frontend"
    
    # Kill any existing processes first
    stop_frontend
    
    # Clear any previous logs
    echo "" > "${LOG_DIR}/frontend.log"
    
    # Update state to INITIALIZING
    update_service_state "frontend" "INITIALIZING"
    
    # Log network configuration before starting
    log "INFO" "Network configuration for frontend:"
    log "INFO" "Host: 127.0.0.1"
    log "INFO" "Port: $FRONTEND_PORT"
    log "INFO" "WebSocket Host: 127.0.0.1"
    
    # Start the React development server with explicit host binding and verbose logging
    export PORT=$FRONTEND_PORT
    export HOST=127.0.0.1
    export WDS_SOCKET_HOST=127.0.0.1
    export BROWSER=none
    export DEBUG=express:*
    export NODE_DEBUG=net
    npm run start > "${LOG_DIR}/frontend.log" 2>&1 &
    local pid=$!
    echo $pid > "${PID_DIR}/frontend.pid"
    
    # Wait for frontend readiness
    if ! check_frontend_readiness 120; then
        log "ERROR" "Frontend failed readiness check"
        update_service_state "frontend" "FAILED"
        cd "$PROJECT_ROOT"
        return 1
    fi
    
    # Update state to READY
    update_service_state "frontend" "READY"
    
    # Final connection test before marking as SERVING
    if curl -s "http://127.0.0.1:${FRONTEND_PORT}" >/dev/null 2>&1; then
        # Get binding details for logging
        local bind_info=$(lsof -i :$FRONTEND_PORT -P -n 2>/dev/null)
        log "INFO" "Frontend binding details:\n$bind_info"
        
        update_service_state "frontend" "SERVING"
        log "SUCCESS" "Frontend started and serving on port $FRONTEND_PORT"
        cd "$PROJECT_ROOT"
        return 0
    else
        log "ERROR" "Frontend final connection test failed"
        update_service_state "frontend" "FAILED"
        cd "$PROJECT_ROOT"
        return 1
    fi
}

stop_frontend() {
    log "INFO" "Stopping frontend service..."
    
    # Define process patterns for frontend
    local patterns=(
        "node.*${PROJECT_ROOT}/frontend/node_modules/.bin/craco start"
        "node.*${PROJECT_ROOT}/frontend/node_modules/react-scripts/scripts/start.js"
        "node.*${PROJECT_ROOT}/frontend/node_modules/.bin/react-scripts start"
    )
    
    # Kill each process tree
    for pattern in "${patterns[@]}"; do
        kill_process_tree "$pattern"
    done
    
    # Verify port is free
    if lsof -i :$FRONTEND_PORT >/dev/null 2>&1; then
        log "WARN" "Port $FRONTEND_PORT still in use after stopping frontend"
        return 1
    fi
    
    # Clean up PID file
    rm -f "${PID_DIR}/frontend.pid"
    
    log "SUCCESS" "Frontend stopped"
    return 0
}

# Enhanced service starting
start_service() {
    local service=$1
    local port=$(get_port "$service")
    
    log "INFO" "Starting $service service..."
    
    # Update state to STARTING
    if ! update_service_state "$service" "STARTING"; then
        log "ERROR" "Invalid state transition to STARTING for $service"
        return 1
    fi
    
    # Check dependencies first
    if ! verify_service_dependencies "$service"; then
        update_service_state "$service" "FAILED"
        return 1
    fi
    
    # Cleanup any stale processes
    cleanup_stale_service "$service"
    
    # Check if port is available
    if ! verify_port_availability "$port" "$service"; then
        update_service_state "$service" "FAILED"
        return 1
    fi
    
    # Start the service based on type
    case "$service" in
        "backend")
            start_backend
            ;;
        "frontend")
            start_frontend
            ;;
        "electron")
            start_electron
            ;;
        *)
            log "ERROR" "Unknown service: $service"
            update_service_state "$service" "FAILED"
            return 1
            ;;
    esac
}

# Start all services in correct order
start_all_services() {
    log "INFO" "Starting all services..."
    
    # Start backend first
    if ! start_backend; then
        log "ERROR" "Failed to start backend"
        stop_all_services
        return 1
    fi
    
    # Wait for backend to be fully ready
    log "INFO" "Waiting for backend to be ready..."
    local retries=30
    while [ $retries -gt 0 ]; do
        if [ "$(get_service_state "backend")" = "SERVING" ]; then
            break
        fi
        sleep 1
        ((retries--))
    done
    
    if [ $retries -eq 0 ]; then
        log "ERROR" "Backend failed to reach SERVING state"
        stop_all_services
        return 1
    fi
    
    # Start frontend
    if ! start_frontend; then
        log "ERROR" "Failed to start frontend"
        stop_all_services
        return 1
    fi
    
    # Wait for frontend to be ready
    log "INFO" "Waiting for frontend to be ready..."
    retries=30
    while [ $retries -gt 0 ]; do
        if [ "$(get_service_state "frontend")" = "SERVING" ]; then
            break
        fi
        sleep 1
        ((retries--))
    done
    
    if [ $retries -eq 0 ]; then
        log "ERROR" "Frontend failed to reach SERVING state"
        stop_all_services
        return 1
    fi
    
    # Start electron last
    if ! start_electron; then
        log "ERROR" "Failed to start Electron"
        stop_all_services
        return 1
    fi
    
    log "SUCCESS" "All services started successfully"
    return 0
}

# Enhanced service stopping
stop_service() {
    local service=$1
    local force=${2:-0}
    
    log "INFO" "Stopping $service service..."
    
    case "$service" in
        "electron")
            kill_electron
            ;;
        *)
            if [ -f "${PID_DIR}/${service}.pid" ]; then
                local pid=$(cat "${PID_DIR}/${service}.pid")
                if kill -0 "$pid" 2>/dev/null && is_our_process "$pid"; then
                    safe_kill "$pid" "$service"
                else
                    log "WARN" "$service not running (stale PID file)"
                fi
                rm -f "${PID_DIR}/${service}.pid"
            else
                log "INFO" "No PID file found for $service"
            fi
            ;;
    esac
}

# Stop all services in reverse order
stop_all_services() {
    log "INFO" "Stopping all services..."
    
    # Stop in reverse order (electron → frontend → backend)
    for service in electron frontend backend; do
        stop_service "$service"
    done
}

# Main service management function
manage_service() {
    local action=$1
    local service=${2:-}
    
    case $action in
        start)
            if [ -z "$service" ]; then
                start_all_services
            else
                case $service in
                    backend) start_backend ;;
                    frontend) start_frontend ;;
                    electron) start_electron ;;
                    *) log "ERROR" "Unknown service: $service"; return 1 ;;
                esac
            fi
            ;;
        stop)
            if [ -z "$service" ]; then
                stop_all_services
            else
                stop_service "$service"
            fi
            ;;
        status)
            local service=$1
            if [ -f "${PID_DIR}/${service}.pid" ]; then
                local pid=$(cat "${PID_DIR}/${service}.pid")
                if kill -0 $pid 2>/dev/null; then
                    log "SUCCESS" "${service} is running (PID: ${pid})"
                    return 0
                fi
            fi
            log "ERROR" "${service} is not running"
            return 1
            ;;
        restart)
            if [ -z "$service" ]; then
                stop_all_services && start_all_services
            else
                stop_service "$service" && \
                case $service in
                    backend) start_backend ;;
                    frontend) start_frontend ;;
                    electron) start_electron ;;
                    *) log "ERROR" "Unknown service: $service"; return 1 ;;
                esac
            fi
            ;;
        *)
            log "ERROR" "Unknown action: $action"
            return 1
            ;;
    esac
}

# Export functions for use by other scripts
export -f manage_service check_port start_service stop_service start_all_services stop_all_services
export -f log 

# Get port for a service
get_port() {
    local service="$1"
    case "$service" in
        "backend")
            echo "$BACKEND_PORT"
            ;;
        "frontend")
            echo "$FRONTEND_PORT"
            ;;
        "electron")
            echo "N/A"  # Electron doesn't use a port directly
            ;;
        *)
            echo "Unknown service: $service" >&2
            return 1
            ;;
    esac
} 