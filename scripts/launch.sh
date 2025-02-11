#!/bin/bash

# Launch script for MAM Application v1.0.4
# Handles both backend services and Electron app
# Author: Claude
# Date: 2024-02-09

# Get the absolute path to the project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Setup logging
LOG_DIR="${PROJECT_DIR}/logs"
mkdir -p "$LOG_DIR"

# Color codes for better visibility
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging function with timestamps
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "${timestamp} [${level}] ${message}" >> "${LOG_DIR}/launcher.log"
    case $level in
        "ERROR") echo -e "${RED}[ERROR] ${message}${NC}" ;;
        "SUCCESS") echo -e "${GREEN}[SUCCESS] ${message}${NC}" ;;
        "WARN") echo -e "${YELLOW}[WARN] ${message}${NC}" ;;
        "INFO") echo -e "${BLUE}[INFO] ${message}${NC}" ;;
    esac
}

# Function to safely check if a port is in use by our application
check_app_port() {
    local port=$1
    local count=$(lsof -ti :$port 2>/dev/null | wc -l)
    return $(( count > 0 ))
}

# Function to kill anything on a port - simple and direct
kill_port() {
    local port=$1
    log "INFO" "Clearing port $port..."
    lsof -ti :$port | xargs kill -9 2>/dev/null || true
}

# Function to kill Electron app - more aggressive
kill_electron() {
    log "INFO" "Stopping Electron app..."
    # Kill both Electron and node processes for our frontend
    pkill -f "electron.*${PROJECT_DIR}/frontend" 2>/dev/null || true
    pkill -f "node.*${PROJECT_DIR}/frontend" 2>/dev/null || true
    # Double check and force kill if still running
    sleep 1
    pkill -9 -f "electron.*${PROJECT_DIR}/frontend" 2>/dev/null || true
}

# Stop all application services safely
stop_services() {
    log "INFO" "Stopping all MAM services..."
    
    # Kill Electron first (it depends on React)
    kill_electron
    
    # Kill anything on our ports
    kill_port 5001  # Backend
    kill_port 3001  # Frontend
    
    # Quick pause
    sleep 1
    
    log "SUCCESS" "All services stopped"
    return 0
}

# Start backend service
start_backend() {
    log "INFO" "Starting backend service..."
    
    # Start backend
    cd "${PROJECT_DIR}/backend" && \
    source .venv/bin/activate && \
    python -m app.main > "${LOG_DIR}/backend.log" 2>&1 &
    
    # Quick check for backend
    sleep 2
    if curl -s "http://localhost:5001/api/v1/health/status" >/dev/null; then
        log "SUCCESS" "Backend started successfully"
        return 0
    else
        log "ERROR" "Backend failed to start. Check logs/backend.log"
        return 1
    fi
}

# Start React development server
start_frontend() {
    log "INFO" "Starting React development server..."
    
    # Ensure frontend port is free
    kill_port 3001
    
    # Set environment variables
    export NODE_ENV=development
    export ELECTRON_START_URL=http://localhost:3001
    export ELECTRON_DISABLE_SECURITY_WARNINGS=true
    
    # Start React dev server
    cd "${PROJECT_DIR}/frontend" && \
    npm start > "${LOG_DIR}/react.log" 2>&1 &
    
    # Wait for React server
    local retries=0
    while ! curl -s "http://localhost:3001" >/dev/null && [ $retries -lt 30 ]; do
        sleep 1
        ((retries++))
        log "INFO" "Waiting for React server... ($retries/30)"
    done
    
    if [ $retries -eq 30 ]; then
        log "ERROR" "React server failed to start. Check logs/react.log"
        return 1
    fi
    
    log "SUCCESS" "React server started successfully"
    return 0
}

# Start React development server and Electron app
start_electron() {
    log "INFO" "Starting React development server and Electron..."
    
    # Set environment variables
    export NODE_ENV=development
    export ELECTRON_START_URL=http://localhost:3001
    export ELECTRON_DISABLE_SECURITY_WARNINGS=true
    export BROWSER=none  # Prevent React from opening browser window
    
    # Start React and Electron using dev command
    cd "${PROJECT_DIR}/frontend" && \
    npm run dev > "${LOG_DIR}/frontend.log" 2>&1 &
    
    # Quick check for React and Electron
    sleep 5
    if ! curl -s "http://localhost:3001" >/dev/null; then
        log "ERROR" "React server failed to start. Check logs/frontend.log"
        return 1
    fi
    
    if ! pgrep -f "electron.*${PROJECT_DIR}/frontend" >/dev/null; then
        log "ERROR" "Electron failed to start. Check logs/frontend.log"
        return 1
    fi
    
    log "SUCCESS" "React and Electron started successfully"
    return 0
}

# Check service status
check_status() {
    local status=0
    
    # Check backend and WebSocket
    local health_response
    health_response=$(curl -s "http://localhost:5001/api/v1/health/status")
    if echo "$health_response" | grep -q '"status":"healthy"'; then
        log "SUCCESS" "Backend is running"
        if echo "$health_response" | grep -q '"websocket":{"status":"healthy"'; then
            log "SUCCESS" "WebSocket is running"
        else
            log "ERROR" "WebSocket is not healthy"
            status=1
        fi
    else
        log "ERROR" "Backend is not running"
        status=1
    fi
    
    # Check React server
    if curl -s "http://localhost:3001" >/dev/null; then
        log "SUCCESS" "React server is running"
    else
        log "ERROR" "React server is not running"
        status=1
    fi
    
    # Check Electron
    if pgrep -f "electron.*${PROJECT_DIR}/frontend" >/dev/null; then
        log "SUCCESS" "Electron is running"
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
        stop_services
        start_backend && start_electron
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services && sleep 2 && start_backend && start_electron
        ;;
    status)
        check_status
        ;;
    logs)
        # Show logs in split view with React logs
        tmux new-session \
            "tail -f ${LOG_DIR}/backend.log" \; \
            split-window -h "tail -f ${LOG_DIR}/react.log" \; \
            split-window -v "tail -f ${LOG_DIR}/electron.log" \; \
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
  - Backend API (Flask)   : :5001
  - Electron App         : :3001
  - WebSocket           : :3003

Logs:
  - Backend  : logs/backend.log
  - Electron : logs/electron.log
  - Launcher : logs/launcher.log
EOF
        ;;
esac

exit 0 