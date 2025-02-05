#!/bin/bash

# manage_services.sh
# Script to manage MAM application services
# Author: Claude
# Date: 2024-02-03

set -e  # Exit on error

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'  # No Color

# Get the absolute paths
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_PATH="${PROJECT_ROOT}/backend/.venv"
PYTHON="${VENV_PATH}/bin/python3"
PIP="${VENV_PATH}/bin/pip"

# Function to activate virtual environment
activate_venv() {
    # Check if we're already in the correct virtual environment
    if [ -n "${VIRTUAL_ENV}" ] && [ "${VIRTUAL_ENV}" = "${VENV_PATH}" ]; then
        echo -e "${GREEN}Already in correct virtual environment: ${VIRTUAL_ENV}${NC}"
        return 0
    fi
    
    if [ -f "${VENV_PATH}/bin/activate" ]; then
        # Only deactivate if we're in a different virtual environment
        if [ -n "${VIRTUAL_ENV}" ] && [ "${VIRTUAL_ENV}" != "${VENV_PATH}" ]; then
            deactivate 2>/dev/null || true
        fi
        
        # Source the virtual environment
        source "${VENV_PATH}/bin/activate"
        
        # Verify we're using the correct Python
        CURRENT_PYTHON=$(which python3)
        if [[ "$CURRENT_PYTHON" != "${VENV_PATH}/bin/python3" ]]; then
            echo -e "${RED}Error: Wrong Python interpreter active: ${CURRENT_PYTHON}${NC}"
            echo -e "${RED}Expected: ${VENV_PATH}/bin/python3${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}Virtual environment activated: ${VENV_PATH}${NC}"
        echo -e "${GREEN}Using Python: ${CURRENT_PYTHON}${NC}"
    else
        echo -e "${RED}Virtual environment not found at ${VENV_PATH}${NC}"
        exit 1
    fi
}

# Function to check if virtual environment exists and has all dependencies
check_dependencies() {
    echo -e "${BLUE}Checking dependencies...${NC}"
    
    # Check if .venv exists
    if [ ! -d "${VENV_PATH}" ]; then
        echo -e "${RED}Virtual environment not found. Running consolidate_venv.sh...${NC}"
        cd "${PROJECT_ROOT}" || exit 1
        "${PROJECT_ROOT}/scripts/consolidate_venv.sh"
        activate_venv
        return
    fi
    
    # Activate virtual environment and check packages
    activate_venv
    
    # Check for critical packages
    MISSING_PACKAGES=0
    REQUIRED_PACKAGES=("flask" "flask-cors" "flask-sock" "flask-sqlalchemy")
    
    for package in "${REQUIRED_PACKAGES[@]}"; do
        if ! "${PIP}" list | grep -i "^$package" > /dev/null; then
            echo -e "${RED}Missing package: $package${NC}"
            MISSING_PACKAGES=1
        fi
    done
    
    if [ $MISSING_PACKAGES -eq 1 ]; then
        echo -e "${RED}Missing required packages. Running consolidate_venv.sh...${NC}"
        deactivate 2>/dev/null || true
        cd "${PROJECT_ROOT}" || exit 1
        "${PROJECT_ROOT}/scripts/consolidate_venv.sh"
        activate_venv
    else
        echo -e "${GREEN}All dependencies are installed.${NC}"
    fi
}

# Service management paths
LOG_DIR="${PROJECT_ROOT}/logs"
PID_DIR="${PROJECT_ROOT}/pids"
mkdir -p "$LOG_DIR" "$PID_DIR"

# Log function with timestamp
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# Start services
start() {
    log "Starting services..."
    
    # Change to project root
    cd "${PROJECT_ROOT}" || exit 1
    
    # Check dependencies and activate venv
    check_dependencies
    
    # Start backend (ensuring we're in venv)
    cd "${PROJECT_ROOT}/backend" || exit 1
    log "Starting backend service..."
    FLASK_APP=run.py FLASK_DEBUG=1 PYTHONPATH="${PROJECT_ROOT}/backend" "${PYTHON}" -m flask run --port=5001 > "${LOG_DIR}/backend.log" 2>&1 &
    echo $! > "${PID_DIR}/backend.pid"
    
    # Start frontend
    cd "${PROJECT_ROOT}/frontend" || exit 1
    log "Starting frontend service..."
    npm start > "${LOG_DIR}/frontend.log" 2>&1 &
    echo $! > "${PID_DIR}/frontend.pid"
    
    # Return to project root
    cd "${PROJECT_ROOT}" || exit 1
    
    # Wait for services to start
    sleep 3
    log "Services started"
    
    # Verify services
    if ! lsof -i:5001 >/dev/null 2>&1; then
        echo -e "${RED}Warning: Backend service not detected on port 5001${NC}"
    fi
    if ! lsof -i:3001 >/dev/null 2>&1; then
        echo -e "${RED}Warning: Frontend service not detected on port 3001${NC}"
    fi
    
    # Print status
    echo -e "${GREEN}Services running with:${NC}"
    echo -e "Backend: ${BLUE}http://localhost:5001${NC}"
    echo -e "Frontend: ${BLUE}http://localhost:3001${NC}"
    echo -e "Virtual Environment: ${BLUE}${VENV_PATH}${NC}"
}

# Stop services
stop() {
    log "Stopping services..."
    
    # Kill processes by PID
    for pid_file in "${PID_DIR}"/*.pid; do
        if [ -f "$pid_file" ]; then
            pid=$(cat "$pid_file")
            kill -9 "$pid" 2>/dev/null || true
            rm -f "$pid_file"
        fi
    done
    
    # Kill any remaining processes on ports
    lsof -ti :5001 | xargs kill -9 2>/dev/null || true
    lsof -ti :3001 | xargs kill -9 2>/dev/null || true
    
    # Kill any lingering Python/Node processes
    pkill -f "python|node|react-scripts|electron" || true
    
    # Deactivate virtual environment if active
    deactivate 2>/dev/null || true
    
    log "Services stopped"
}

# Main command handling
case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        stop
        sleep 2
        start
        ;;
    *)
        echo "Usage: $0 {start|stop|restart}"
        exit 1
        ;;
esac

exit 0 