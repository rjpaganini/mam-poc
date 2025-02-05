#!/bin/bash

# Safer MAM Application Restart Script
# This script carefully targets only our application processes

echo "==============================================="
echo "🚀 MAM Application Launcher v1.0.5"
echo "==============================================="

# Directory setup
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="${PROJECT_ROOT}/logs"
VENV_PATH="${PROJECT_ROOT}/backend/.venv"

# Create logs directory if it doesn't exist
mkdir -p "${LOG_DIR}"

# Function to check if a port is in use
check_port() {
    lsof -i :"$1" >/dev/null 2>&1
}

# Function to safely kill process on a specific port
kill_port() {
    local port=$1
    if check_port "$port"; then
        echo "ℹ️ Killing process on port $port"
        # Only kill processes that match our application patterns
        lsof -ti :"$port" | while read -r pid; do
            if ps -p "$pid" -o command= | grep -E "python.*run\.py|node.*start|electron" > /dev/null; then
                echo "ℹ️ Killing process $pid on port $port"
                kill -9 "$pid" 2>/dev/null
            fi
        done
    fi
}

# Function to safely kill processes by command pattern
kill_process() {
    local pattern=$1
    # Use pgrep to find PIDs and exclude the script itself and Cursor processes
    pgrep -f "$pattern" | while read -r pid; do
        if ! ps -p "$pid" -o command= | grep -iE "cursor|code|vscode" > /dev/null; then
            if ps -p "$pid" -o command= | grep -E "python.*run\.py|node.*start|electron" > /dev/null; then
                echo "ℹ️ Killing process $pid ($pattern)"
                kill -9 "$pid" 2>/dev/null
            fi
        fi
    done
}

echo "ℹ️ Cleaning up existing services..."

# Kill specific ports used by our application
kill_port 5001  # Backend port
kill_port 3001  # Frontend port

# Safely kill our application processes
kill_process "python.*run\.py"
kill_process "npm.*start"
kill_process "electron"

echo "✅ Cleanup complete"

# Activate virtual environment
source "${VENV_PATH}/bin/activate"

# Start services
echo "🚀 Starting MAM Application Stack..."

# Start backend with proper entry point
echo "ℹ️ Starting backend service on port 5001..."
cd "${PROJECT_ROOT}/backend" && \
FLASK_APP=run.py FLASK_ENV=development PYTHONPATH="${PROJECT_ROOT}/backend" \
python run.py > "${LOG_DIR}/backend.log" 2>&1 &

# Wait for backend to be ready
max_attempts=3
attempt=1
while ! curl -s http://localhost:5001/api/v1/health/status >/dev/null; do
    if [ $attempt -eq $max_attempts ]; then
        echo "⚠️ Backend not detected, retrying... ($attempt/$max_attempts)"
        break
    fi
    echo "⚠️ Backend not detected, retrying... ($attempt/$max_attempts)"
    sleep 2
    ((attempt++))
done

# Start frontend
echo "ℹ️ Starting frontend service on port 3001..."
cd "${PROJECT_ROOT}/frontend" && \
npm start > "${LOG_DIR}/frontend.log" 2>&1 &

# Wait for frontend to be ready
attempt=1
while ! curl -s http://localhost:3001 >/dev/null; do
    if [ $attempt -eq $max_attempts ]; then
        echo "⚠️ Frontend not detected, retrying... ($attempt/$max_attempts)"
        break
    fi
    echo "⚠️ Frontend not detected, retrying... ($attempt/$max_attempts)"
    sleep 2
    ((attempt++))
done

# Verify services
backend_running=false
frontend_running=false

if curl -s http://localhost:5001/api/v1/health/status >/dev/null; then
    echo "✅ Backend service verified on port 5001"
    backend_running=true
fi

if curl -s http://localhost:3001 >/dev/null; then
    echo "✅ Frontend service verified on port 3001"
    frontend_running=true
fi

# Launch Electron app
if [ "$backend_running" = true ] && [ "$frontend_running" = true ]; then
    echo "ℹ️ Launching Electron application..."
    cd "${PROJECT_ROOT}/frontend" && \
    ELECTRON_START_URL=http://localhost:3001 npm run electron-dev > "${LOG_DIR}/electron.log" 2>&1 &
    echo "✅ Application stack started successfully"
else
    echo "🚫 Service verification failed"
    echo "ℹ️ Cleaning up existing services..."
    kill_port 5001
    kill_port 3001
    kill_process "python.*run\.py"
    kill_process "npm.*start"
    kill_process "electron"
    echo "✅ Cleanup complete"
    echo "🚫 Please try running the launcher again"
fi 