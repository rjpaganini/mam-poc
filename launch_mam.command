#!/bin/bash

# launch_mam.command
# One-click launcher for Media Asset Manager
# Author: Claude
# Description: Launches backend server, frontend dev server, and opens the web interface
# Usage: Double-click this file or run ./launch_mam.command

# Color codes for pretty output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if Homebrew is installed (handles both Intel and M1 Macs)
check_homebrew() {
    if [ -f "/opt/homebrew/bin/brew" ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
        return 0
    elif [ -f "/usr/local/bin/brew" ]; then
        eval "$(/usr/local/bin/brew shellenv)"
        return 0
    else
        return 1
    fi
}

# Function to check if a port is in use
check_port() {
    lsof -i:$1 >/dev/null 2>&1
    return $?
}

# Function to kill process on a port
kill_port() {
    lsof -ti:$1 | xargs kill -9 2>/dev/null
}

# Function to check and install system dependencies
check_dependencies() {
    echo -e "${BLUE}Checking system dependencies...${NC}"
    
    # Check for Homebrew on macOS
    if [[ "$(uname)" == "Darwin" ]]; then
        if ! check_homebrew; then
            echo -e "${RED}Homebrew is required but not installed. Please install it first:${NC}"
            echo '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
            exit 1
        fi
        
        # Ensure Python 3.11 is installed
        if ! brew list python@3.11 &>/dev/null; then
            echo -e "${BLUE}Installing Python 3.11...${NC}"
            brew install python@3.11
        fi
    fi
    
    # Check for libmagic
    if [[ "$(uname)" == "Darwin" ]]; then
        if ! brew list libmagic &>/dev/null; then
            echo -e "${BLUE}Installing libmagic...${NC}"
            brew install libmagic
        fi
    elif [[ "$(uname)" == "Linux" ]]; then
        if ! command_exists file; then
            echo -e "${BLUE}Installing libmagic...${NC}"
            sudo apt-get update && sudo apt-get install -y libmagic1
        fi
    fi
    
    # Check for ffmpeg
    if ! command_exists ffmpeg; then
        echo -e "${BLUE}Installing ffmpeg...${NC}"
        if [[ "$(uname)" == "Darwin" ]]; then
            brew install ffmpeg
        elif [[ "$(uname)" == "Linux" ]]; then
            sudo apt-get update && sudo apt-get install -y ffmpeg
        fi
    fi
}

echo -e "${BLUE}🚀 Starting Media Asset Manager...${NC}"

# Check system dependencies first
check_dependencies

# Clean up any existing processes
echo -e "${BLUE}Cleaning up existing processes...${NC}"
if check_port 5001; then
    echo -e "${BLUE}Cleaning up backend on port 5001...${NC}"
    kill_port 5001
fi
if check_port 3001; then
    echo -e "${BLUE}Cleaning up frontend on port 3001...${NC}"
    kill_port 3001
fi

# Navigate to project directory
cd "$SCRIPT_DIR"

# Start backend server
echo -e "${BLUE}Starting backend server...${NC}"
cd backend

# Create and activate virtual environment if needed
source .venv/bin/activate 2>/dev/null || {
    echo -e "${BLUE}Creating virtual environment...${NC}"
    if [[ "$(uname)" == "Darwin" ]]; then
        # Use Python 3.11 specifically on macOS
        /opt/homebrew/opt/python@3.11/bin/python3.11 -m venv .venv
    else
        python3.11 -m venv .venv
    fi
    source .venv/bin/activate
    
    echo -e "${BLUE}Installing backend dependencies...${NC}"
    pip install --upgrade pip
    
    # Install python-magic with libmagic
    if [[ "$(uname)" == "Darwin" ]]; then
        echo -e "${BLUE}Installing libmagic and python-magic for macOS...${NC}"
        brew install libmagic
        export CFLAGS="-I/opt/homebrew/include"
        export LDFLAGS="-L/opt/homebrew/lib"
        pip install python-magic
    else
        echo -e "${BLUE}Installing python-magic for Linux...${NC}"
        pip install python-magic
    fi
    
    # Now install the rest of the requirements
    pip install -r requirements.txt
}

# If virtual env exists but magic isn't installed, install it
if ! python3 -c "import magic" 2>/dev/null; then
    echo -e "${BLUE}Installing missing python-magic package...${NC}"
    if [[ "$(uname)" == "Darwin" ]]; then
        brew install libmagic
        export CFLAGS="-I/opt/homebrew/include"
        export LDFLAGS="-L/opt/homebrew/lib"
    fi
    pip install python-magic
fi

# Ensure .env file exists
if [ ! -f ".env" ]; then
    echo -e "${BLUE}Creating default .env file...${NC}"
    echo "FLASK_APP=app" > .env
    echo "FLASK_ENV=development" >> .env
    echo "MEDIA_BASE_PATH=\"$HOME/Documents/media\"" >> .env
    mkdir -p "$HOME/Documents/media"
fi

python run.py &
BACKEND_PID=$!

# Wait for backend to be ready (max 30 seconds)
echo -e "${BLUE}Waiting for backend to start...${NC}"
COUNTER=0
until $(curl --output /dev/null --silent --head --fail http://localhost:5001/api/v1/health); do
    printf '.'
    sleep 1
    COUNTER=$((COUNTER + 1))
    if [ $COUNTER -gt 30 ]; then
        echo -e "${RED}Backend failed to start within 30 seconds${NC}"
        echo -e "${RED}Check the logs above for errors${NC}"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
done
echo -e "${GREEN}Backend ready!${NC}"

# Start frontend
echo -e "${BLUE}Starting frontend...${NC}"
cd ../frontend
# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}Installing frontend dependencies...${NC}"
    npm install
fi

# Ensure frontend .env exists
if [ ! -f ".env" ]; then
    echo -e "${BLUE}Creating frontend .env file...${NC}"
    echo "PORT=3001" > .env
    echo "REACT_APP_API_PORT=5001" >> .env
    echo "REACT_APP_API_HOST=localhost" >> .env
fi

npm start &
FRONTEND_PID=$!

# Wait for frontend to be ready (max 60 seconds)
echo -e "${BLUE}Waiting for frontend to start...${NC}"
COUNTER=0
until $(curl --output /dev/null --silent --head --fail http://localhost:3001); do
    printf '.'
    sleep 1
    COUNTER=$((COUNTER + 1))
    if [ $COUNTER -gt 60 ]; then
        echo -e "${RED}Frontend failed to start within 60 seconds${NC}"
        kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
        exit 1
    fi
done
echo -e "${GREEN}Frontend ready!${NC}"

# Wait a moment for services to stabilize
sleep 2

# Open web interface (platform-specific)
echo -e "${GREEN}Opening web interface...${NC}"
case "$(uname)" in
    "Darwin") # macOS
        open -a "Google Chrome" --args --new-window "http://localhost:3001"
        ;;
    "Linux")
        xdg-open "http://localhost:3001"
        ;;
    "MINGW"*|"MSYS"*|"CYGWIN"*) # Windows
        start chrome --new-window "http://localhost:3001"
        ;;
    *)
        echo -e "${RED}Unsupported platform. Please open http://localhost:3001 manually${NC}"
        ;;
esac

# Show status
echo -e "${GREEN}✨ Media Asset Manager is running!${NC}"
echo -e "${BLUE}Backend URL: ${NC}http://localhost:5001"
echo -e "${BLUE}Frontend URL: ${NC}http://localhost:3001"
echo -e "${BLUE}Press Ctrl+C to stop all services${NC}"

# Handle script termination
cleanup() {
    echo -e "\n${BLUE}Shutting down services...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    kill_port 5001
    kill_port 3001
    echo -e "${GREEN}All services stopped${NC}"
    exit 0
}
trap cleanup EXIT INT TERM

# Keep script running
wait 