#!/bin/bash
# ==============================================================================
# MAM Application Launcher v1.0.5
# ==============================================================================
# Intelligent launcher that ensures proper environment and service management
# One-click solution for launching the entire MAM application stack
# ==============================================================================

# Ensure script is executable regardless of how it's launched
if [[ ! -x "$0" ]]; then
    chmod +x "$0"
fi

# Get absolute paths, handling both symlinks and direct execution
SCRIPT_LOCATION="${BASH_SOURCE[0]}"
while [ -L "$SCRIPT_LOCATION" ]; do
    SCRIPT_LOCATION="$(readlink "$SCRIPT_LOCATION")"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SCRIPT_LOCATION")" && pwd)"
SCRIPT_NAME="$(basename "$SCRIPT_LOCATION")"

# Development mode configuration
DEV_MODE=${DEV_MODE:-true}  # Can be overridden by environment
if [[ "$DEV_MODE" == "true" ]]; then
    FLASK_DEBUG=1
    FLASK_ENV="development"
    log "INFO" "Running in DEVELOPMENT mode with auto-reloader"
else
    FLASK_DEBUG=0
    FLASK_ENV="production"
    log "INFO" "Running in PRODUCTION mode without auto-reloader"
fi

# Validate we're in the correct project structure
validate_project_structure() {
    local required_dirs=("backend" "frontend")
    local required_files=("backend/requirements.txt" "frontend/package.json")
    
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "${SCRIPT_DIR}/${dir}" ]]; then
            echo "${ERROR_PREFIX} Error: Required directory '${dir}' not found!"
            echo "This script must be run from the MAM project root directory."
            echo "Current location: ${SCRIPT_DIR}"
            exit 1
        fi
    done
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "${SCRIPT_DIR}/${file}" ]]; then
            echo "${ERROR_PREFIX} Error: Required file '${file}' not found!"
            echo "Project structure appears to be incomplete."
            exit 1
        fi
    done
}

# Create required directories
mkdir -p "${SCRIPT_DIR}/pids"
mkdir -p "${SCRIPT_DIR}/logs"

# Visual feedback with emojis
ERROR_PREFIX="🚫"
SUCCESS_PREFIX="✅"
INFO_PREFIX="ℹ️"
WARN_PREFIX="⚠️"
ROCKET_PREFIX="🚀"

# Log file setup with rotation
LOG_DIR="${SCRIPT_DIR}/logs"
LOG_FILE="${LOG_DIR}/launcher.log"
MAX_LOG_SIZE=$((10 * 1024 * 1024)) # 10MB

# Rotate logs if too large
if [[ -f "$LOG_FILE" ]] && [[ $(stat -f%z "$LOG_FILE") -gt $MAX_LOG_SIZE ]]; then
    mv "$LOG_FILE" "${LOG_FILE}.old"
fi

# Enhanced logging function with timestamps and console output
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local log_message="${timestamp} [${level}] ${message}"
    echo "$log_message" >> "${LOG_FILE}"
    
    # Pretty console output
    case $level in
        "ERROR") echo "${ERROR_PREFIX} ${message}" ;;
        "SUCCESS") echo "${SUCCESS_PREFIX} ${message}" ;;
        "INFO") echo "${INFO_PREFIX} ${message}" ;;
        "WARN") echo "${WARN_PREFIX} ${message}" ;;
        "LAUNCH") echo "${ROCKET_PREFIX} ${message}" ;;
    esac
}

# Check dependencies
check_dependencies() {
    local deps=("python3" "node" "npm" "lsof" "pkill")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" >/dev/null 2>&1; then
            log "ERROR" "Required dependency '$dep' not found!"
            log "ERROR" "Please install '$dep' and try again."
            exit 1
        fi
    done
}

# Check if services are already running
check_services() {
    local backend_port=5001
    local frontend_port=3001
    
    # Check backend
    if lsof -i:${backend_port} >/dev/null 2>&1; then
        log "WARN" "Backend service already running on port ${backend_port} - will clean up"
        return 0
    fi
    
    # Check frontend
    if lsof -i:${frontend_port} >/dev/null 2>&1; then
        log "WARN" "Frontend service already running on port ${frontend_port} - will clean up"
        return 0
    fi
    
    return 1
}

# Enhanced cleanup with better process management
cleanup_services() {
    log "INFO" "Cleaning up existing services..."
    
    # Kill processes on specific ports
    for port in 5001 3001; do
        if lsof -ti :$port >/dev/null 2>&1; then
            log "INFO" "Killing process on port $port"
            lsof -ti :$port | xargs kill -9 2>/dev/null || true
        fi
    done
    
    # Kill any lingering processes more carefully
    for process in "python" "node" "react-scripts" "electron"; do
        if pgrep -f "$process" >/dev/null; then
            log "INFO" "Killing $process processes"
            pkill -9 -f "$process" 2>/dev/null || true
        fi
    done
    
    # Clean up pid files
    rm -f "${SCRIPT_DIR}/pids/"*.pid 2>/dev/null || true
    
    # Give processes time to fully terminate
    sleep 2
    
    log "SUCCESS" "Cleanup complete"
}

# Start services with better error handling
start_services() {
    log "LAUNCH" "Starting MAM Application Stack..."
    
    # Setup backend
    cd "${SCRIPT_DIR}/backend" || {
        log "ERROR" "Failed to access backend directory"
        exit 1
    }
    
    # Create/update virtual environment
    if [[ ! -d ".venv" ]] || [[ ! -f ".venv/bin/activate" ]]; then
        log "INFO" "Setting up Python virtual environment..."
        python3 -m venv .venv
        source .venv/bin/activate
        pip install --upgrade pip
        pip install -r requirements.txt
    else
        source .venv/bin/activate
    fi
    
    # Start backend
    log "INFO" "Starting backend service on port 5001..."
    FLASK_APP=run.py \
    FLASK_DEBUG=$FLASK_DEBUG \
    FLASK_ENV=$FLASK_ENV \
    PYTHONPATH="${SCRIPT_DIR}/backend" \
    API_PORT=5001 \
    "${SCRIPT_DIR}/backend/.venv/bin/python" -m flask run --port=5001 > "${LOG_DIR}/backend.log" 2>&1 &
    echo $! > "${SCRIPT_DIR}/pids/backend.pid"
    
    # Setup and start frontend
    cd "${SCRIPT_DIR}/frontend" || {
        log "ERROR" "Failed to access frontend directory"
        cleanup_services
        exit 1
    }
    
    # Install/update npm packages if needed
    if [[ ! -d "node_modules" ]]; then
        log "INFO" "Installing frontend dependencies..."
        npm install
    fi
    
    # Start frontend
    log "INFO" "Starting frontend service on port 3001..."
    REACT_APP_API_PORT=5001 npm start > "${LOG_DIR}/frontend.log" 2>&1 &
    echo $! > "${SCRIPT_DIR}/pids/frontend.pid"
    
    # Start Electron (with proper waiting)
    log "INFO" "Launching Electron application..."
    cd "${SCRIPT_DIR}/frontend" && \
    (sleep 5 && ELECTRON_START_URL=http://localhost:3001 npm run electron-dev > "${LOG_DIR}/electron.log" 2>&1) &
    echo $! > "${SCRIPT_DIR}/pids/electron.pid"
    
    # Return to project root
    cd "${SCRIPT_DIR}" || exit 1
    
    # Verify services
    sleep 3
    verify_services
}

# Enhanced service verification
verify_services() {
    local backend_running=false
    local frontend_running=false
    local max_retries=3
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        if lsof -i:5001 >/dev/null 2>&1; then
            backend_running=true
            log "SUCCESS" "Backend service verified on port 5001"
            break
        else
            retry_count=$((retry_count + 1))
            if [ $retry_count -lt $max_retries ]; then
                log "WARN" "Backend not detected, retrying... ($retry_count/$max_retries)"
                sleep 2
            fi
        fi
    done
    
    retry_count=0
    while [ $retry_count -lt $max_retries ]; do
        if lsof -i:3001 >/dev/null 2>&1; then
            frontend_running=true
            log "SUCCESS" "Frontend service verified on port 3001"
            break
        else
            retry_count=$((retry_count + 1))
            if [ $retry_count -lt $max_retries ]; then
                log "WARN" "Frontend not detected, retrying... ($retry_count/$max_retries)"
                sleep 2
            fi
        fi
    done
    
    if [ "$backend_running" = true ] && [ "$frontend_running" = true ]; then
        log "SUCCESS" "All services running successfully! 🎉"
        return 0
    else
        log "ERROR" "Service verification failed after $max_retries attempts"
        cleanup_services
        log "ERROR" "Please try running the launcher again"
        exit 1
    fi
}

# Main execution
clear # Clear terminal for better visibility
echo "==============================================="
echo "🚀 MAM Application Launcher v1.0.5"
echo "==============================================="

# Validate project structure
validate_project_structure

# Check dependencies
check_dependencies

# Always clean up first
cleanup_services

# Start all services fresh
start_services

# Print final status
log "LAUNCH" "MAM Application Stack is ready!"
log "INFO" "Backend: http://localhost:5001"
log "INFO" "Frontend: http://localhost:3001"
log "INFO" "Logs: ${LOG_DIR}"

# Keep the terminal window open if there's an error
if [ $? -ne 0 ]; then
    log "ERROR" "Press any key to close this window..."
    read -n 1
fi 