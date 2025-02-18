#!/bin/bash

# health_check.sh
# Comprehensive health monitoring for MAM services
# Author: Claude (Sr Dev)
# Version: 2.0.0

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

# Check backend health including WebSocket
check_backend() {
    if ! check_port $BACKEND_PORT; then
        print_status "Backend" "ERROR" "(Port $BACKEND_PORT not responding)"
        return 1
    fi
    
    # Check API health endpoint
    local response=$(curl -s "http://localhost:$BACKEND_PORT/api/v1/health/status" 2>/dev/null)
    if [ $? -eq 0 ] && [[ $response == *"healthy"* ]]; then
        print_status "Backend" "OK" "(Port $BACKEND_PORT)"
        
        # Parse WebSocket status from the health response
        local ws_status=$(echo "$response" | python3 -c "import sys, json; health = json.load(sys.stdin); print(health.get('websocket', {}).get('status', 'unknown'))")
        local ws_connections=$(echo "$response" | python3 -c "import sys, json; health = json.load(sys.stdin); print(health.get('websocket', {}).get('connections', 0))")
        
        if [ "$ws_status" = "healthy" ]; then
            print_status "WebSocket" "OK" "(${ws_connections} active connections)"
        else
            print_status "WebSocket" "WARN" "(Status: ${ws_status})"
        fi
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

# Check media processing
check_processing() {
    local proc_status=$(curl -s "http://localhost:$BACKEND_PORT/api/v1/health/status" 2>/dev/null)
    if [ $? -eq 0 ]; then
        # Parse processing status from health endpoint
        local queue_status=$(echo "$proc_status" | python3 -c "import sys, json; health = json.load(sys.stdin); print(health.get('processing', {}).get('status', 'unknown'))")
        local queue_size=$(echo "$proc_status" | python3 -c "import sys, json; health = json.load(sys.stdin); print(health.get('processing', {}).get('queue_size', 0))")
        local active_jobs=$(echo "$proc_status" | python3 -c "import sys, json; health = json.load(sys.stdin); print(health.get('processing', {}).get('active_jobs', 0))")
        
        if [ "$queue_status" = "healthy" ]; then
            print_status "Media Processing" "OK" "(Queue: ${queue_size}, Active: ${active_jobs})"
        else
            print_status "Media Processing" "WARN" "(Status: ${queue_status})"
        fi
    else
        print_status "Media Processing" "ERROR" "(Status unknown)"
        return 1
    fi
}

# Check logs with improved error categorization
check_logs() {
    local log_dir="$PROJECT_DIR/logs"
    local error_count=0
    local warn_count=0
    
    # Count errors and warnings in the last 24h
    if [ -f "$log_dir/error.log" ]; then
        error_count=$(find "$log_dir/error.log" -mtime -1 -exec grep -c "\[ERROR\]" {} \; 2>/dev/null || echo "0")
        warn_count=$(find "$log_dir/error.log" -mtime -1 -exec grep -c "\[WARN\]" {} \; 2>/dev/null || echo "0")
    fi
    
    if [[ "$error_count" == "0" && "$warn_count" == "0" ]]; then
        print_status "Logs" "OK" "(No issues in last 24h)"
    elif [[ "$error_count" == "0" ]]; then
        print_status "Logs" "WARN" "($warn_count warnings in last 24h)"
    else
        print_status "Logs" "WARN" "($error_count errors, $warn_count warnings in last 24h)"
    fi
}

# Check database health
check_database() {
    local db_status=$(curl -s "http://localhost:$BACKEND_PORT/api/v1/health/status" | python3 -c "import sys, json; health = json.load(sys.stdin); print(health.get('database', {}).get('status', 'unknown'))")
    
    if [ "$db_status" = "healthy" ]; then
        print_status "Database" "OK" "(Connected)"
    else
        print_status "Database" "ERROR" "(Status: ${db_status})"
        return 1
    fi
}

# Main health check
main() {
    echo "MAM Health Check - $(date '+%Y-%m-%d %H:%M:%S')"
    echo "----------------------------------------"
    
    local errors=0
    
    check_database || ((errors++))
    check_backend || ((errors++))
    check_frontend || ((errors++))
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