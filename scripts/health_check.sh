#!/bin/bash

# health_check.sh
# Comprehensive health monitoring for MAM services
# Author: Claude (Sr Dev)
# Version: 1.0.0

# Get the absolute path to the project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Service ports
BACKEND_PORT=5001
FRONTEND_PORT=3001

# Print status with color
print_status() {
    local service=$1
    local status=$2
    local details=$3
    
    case $status in
        "OK")
            echo -e "${GREEN}✓${NC} $service: ${GREEN}Running${NC} $details"
            ;;
        "WARN")
            echo -e "${YELLOW}!${NC} $service: ${YELLOW}Warning${NC} $details"
            ;;
        "ERROR")
            echo -e "${RED}✗${NC} $service: ${RED}Error${NC} $details"
            ;;
    esac
}

# Check if a port is in use
check_port() {
    lsof -i:$1 -sTCP:LISTEN >/dev/null 2>&1
}

# Check backend health
check_backend() {
    if ! check_port $BACKEND_PORT; then
        print_status "Backend" "ERROR" "(Port $BACKEND_PORT not responding)"
        return 1
    fi
    
    # Check API health endpoint
    local response=$(curl -s "http://localhost:$BACKEND_PORT/api/v1/health/status" 2>/dev/null)
    if [ $? -eq 0 ] && [[ $response == *"healthy"* ]]; then
        print_status "Backend" "OK" "(Port $BACKEND_PORT)"
    else
        print_status "Backend" "ERROR" "(Health check failed)"
        return 1
    fi
}

# Check frontend health
check_frontend() {
    if check_port $FRONTEND_PORT; then
        print_status "Frontend" "OK" "(Port $FRONTEND_PORT)"
    else
        print_status "Frontend" "ERROR" "(Port $FRONTEND_PORT not responding)"
        return 1
    fi
}

# Check WebSocket connection
check_websocket() {
    local ws_status=$(curl -s "http://localhost:$BACKEND_PORT/api/v1/health/websocket" 2>/dev/null)
    if [ $? -eq 0 ] && [[ $ws_status == *"connected"* ]]; then
        print_status "WebSocket" "OK" "(Active connections: $(echo $ws_status | grep -o '"connections":[0-9]*' | cut -d':' -f2))"
    else
        print_status "WebSocket" "ERROR" "(Not responding)"
        return 1
    fi
}

# Check media processing
check_processing() {
    local proc_status=$(curl -s "http://localhost:$BACKEND_PORT/api/v1/health/processing" 2>/dev/null)
    if [ $? -eq 0 ]; then
        local queue_size=$(echo $proc_status | grep -o '"queue_size":[0-9]*' | cut -d':' -f2)
        local active_jobs=$(echo $proc_status | grep -o '"active_jobs":[0-9]*' | cut -d':' -f2)
        print_status "Media Processing" "OK" "(Queue: $queue_size, Active: $active_jobs)"
    else
        print_status "Media Processing" "ERROR" "(Status unknown)"
        return 1
    fi
}

# Check logs
check_logs() {
    local log_dir="$PROJECT_DIR/logs"
    local error_count
    error_count=$(grep -c "\[ERROR\]" "$log_dir/error.log" 2>/dev/null || echo "0")
    if [[ "$error_count" == "0" ]]; then
        print_status "Logs" "OK" "(No errors)"
    else
        print_status "Logs" "WARN" "($error_count errors in last 24h)"
    fi
}

# Main health check
main() {
    echo "MAM Health Check - $(date '+%Y-%m-%d %H:%M:%S')"
    echo "----------------------------------------"
    
    local errors=0
    
    check_backend || ((errors++))
    check_frontend || ((errors++))
    check_websocket || ((errors++))
    check_processing || ((errors++))
    check_logs
    
    echo "----------------------------------------"
    if [ $errors -eq 0 ]; then
        echo -e "${GREEN}All systems operational${NC}"
    else
        echo -e "${RED}$errors service(s) reporting issues${NC}"
    fi
}

# Run health check
main

# For monitoring mode
if [ "$1" == "--monitor" ]; then
    echo "Monitoring mode enabled (Ctrl+C to exit)"
    while true; do
        clear
        main
        sleep 5
    done
fi 