#!/bin/bash

# Launch script for MAM Application
# Purpose: Provides a convenient way to start/stop services from anywhere
# Author: Claude
# Date: 2024-02-03

# Get the absolute path to the project directory
PROJECT_DIR="/Users/rjpaganini/Documents/mam-poc"

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'  # No Color

# Function to check Python version
check_python_version() {
    required_version="3.11"
    current_version=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
    
    if [[ "$current_version" != "$required_version"* ]]; then
        echo -e "${RED}Error: Python $required_version.x is required (found $current_version)${NC}"
        exit 1
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: mam {start|stop|restart}"
    echo "  start    - Start all services"
    echo "  stop     - Stop all services"
    echo "  restart  - Restart all services"
}

# Check Python version first
check_python_version

# Check if command is provided
if [ $# -eq 0 ]; then
    show_usage
    exit 1
fi

# Execute the command
cd "${PROJECT_DIR}" && ./scripts/manage_services.sh "$1" 