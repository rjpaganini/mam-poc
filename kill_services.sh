#!/bin/bash

# kill_services.sh - Terminates lingering processes on service ports
# Purpose: Ensures no stale processes are running that could conflict with starting new services

# Color codes for pretty output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${RED}Stopping all MAM services...${NC}"

# Function to kill process by port
kill_port() {
    local port=$1
    # Get PID of process using the port
    pid=$(lsof -ti :$port)
    if [ ! -z "$pid" ]; then
        echo -e "Killing process on port $port (PID: $pid)"
        kill -9 $pid 2>/dev/null
    else
        echo -e "No process found on port $port"
    fi
}

# Kill processes on our designated ports
kill_port 3001  # Frontend
kill_port 5001  # Backend

# Additional cleanup for any Python processes
pkill -f "python.*app.py" 2>/dev/null
pkill -f "python.*backend" 2>/dev/null

# Additional cleanup for any Node processes
pkill -f "node.*react-scripts" 2>/dev/null

echo -e "${GREEN}All services stopped!${NC}"

# Verify ports are clear
echo -e "${RED}Verifying ports are clear...${NC}"
sleep 1
if [ -z "$(lsof -ti :3001)" ] && [ -z "$(lsof -ti :5001)" ]; then
    echo -e "${GREEN}All ports are clear${NC}"
else
    echo -e "${RED}Warning: Some ports may still be in use${NC}"
    lsof -i :3001,5001
fi 