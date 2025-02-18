#!/bin/bash

# health_monitor.sh
# Comprehensive health monitoring for MAM services
# Author: Senior Developer
# Version: 2.0.0
# Last Updated: 2024-02-13

# Strict error handling
set -euo pipefail

# Use PROJECT_ROOT from parent script
cd "$PROJECT_ROOT"

# Source core utilities
source "${PROJECT_ROOT}/scripts/core/service_manager.sh"

# Configuration
LOG_DIR="${PROJECT_ROOT}/logs"
HEALTH_REPORT="${LOG_DIR}/health_report.json"

# Health check functions
check_backend() {
    log "INFO" "Checking backend service..."
    if curl -s "http://localhost:${BACKEND_PORT}/api/v1/health/status" | grep -q "healthy"; then
        log "SUCCESS" "Backend service is healthy"
        return 0
    fi
    log "ERROR" "Backend service is not responding"
    return 1
}

check_frontend() {
    log "INFO" "Checking frontend service..."
    if curl -s "http://localhost:${FRONTEND_PORT}" >/dev/null; then
        log "SUCCESS" "Frontend service is healthy"
        return 0
    fi
    log "ERROR" "Frontend service is not responding"
    return 1
}

check_system_resources() {
    log "INFO" "Checking system resources..."
    
    # Check disk space
    if [[ "$(uname)" == "Darwin" ]]; then
        # macOS: Get root volume space (what Finder shows)
        local disk_info=$(df -h / | tail -n 1)
        local avail_space=$(echo "$disk_info" | awk '{print $4}')
        local total_space=$(echo "$disk_info" | awk '{print $2}')
        local used_space=$(echo "$disk_info" | awk '{print $3}')
        local usage_percent=$(echo "$disk_info" | awk '{print $5}' | sed 's/%//')
        
        log "INFO" "System Storage: ${avail_space} available of ${total_space} total (${used_space} used)"
        
        if [[ $usage_percent -gt 90 ]]; then
            log "ERROR" "Storage critically low: ${avail_space} available"
            return 1
        elif [[ $usage_percent -gt 80 ]]; then
            log "WARN" "Storage running low: ${avail_space} available"
        else
            log "SUCCESS" "Storage space normal: ${avail_space} available"
        fi
    else
        # Linux disk usage
        disk_usage=$(df -h "$PROJECT_ROOT" | awk 'NR==2 {print $5}' | sed 's/%//')
        if [[ $disk_usage -gt 90 ]]; then
            log "ERROR" "Disk usage critical: ${disk_usage}%"
            return 1
        elif [[ $disk_usage -gt 80 ]]; then
            log "WARN" "Disk usage high: ${disk_usage}%"
        else
            log "SUCCESS" "Disk usage normal: ${disk_usage}%"
        fi
    fi
    
    # Check memory usage
    if [[ "$(uname)" == "Darwin" ]]; then
        # macOS memory check using memory pressure
        local memory_pressure
        memory_pressure=$(memory_pressure | grep "System-wide memory free percentage:" | awk '{print $5}' | cut -d'.' -f1 | tr -d '%')
        
        if [[ $memory_pressure -lt 15 ]]; then
            log "ERROR" "High memory pressure: ${memory_pressure}% free"
            return 1
        elif [[ $memory_pressure -lt 25 ]]; then
            log "WARN" "Elevated memory pressure: ${memory_pressure}% free"
        else
            log "SUCCESS" "Memory pressure normal: ${memory_pressure}% free"
        fi
    else
        # Linux memory check
        local memory_available
        memory_available=$(free -g | awk '/Mem:/ {print $7}')
        
        if [[ $memory_available -lt 2 ]]; then
            log "ERROR" "Low memory available: ${memory_available}GB"
            return 1
        elif [[ $memory_available -lt 4 ]]; then
            log "WARN" "Memory running low: ${memory_available}GB"
        else
            log "SUCCESS" "Memory usage normal: ${memory_available}GB available"
        fi
    fi
    
    return 0
}

check_log_health() {
    log "INFO" "Analyzing logs..."
    
    local log_dir="${PROJECT_ROOT}/logs"
    local error_count=0
    local warn_count=0
    
    # Check for errors in the last hour
    if [[ -f "${log_dir}/error.log" ]]; then
        error_count=$(find "${log_dir}/error.log" -mmin -60 -exec grep -c "\[ERROR\]" {} \; 2>/dev/null || echo "0")
        warn_count=$(find "${log_dir}/error.log" -mmin -60 -exec grep -c "\[WARN\]" {} \; 2>/dev/null || echo "0")
    fi
    
    if [[ $error_count -gt 0 ]]; then
        log "ERROR" "Found $error_count errors in the last hour"
        return 1
    elif [[ $warn_count -gt 0 ]]; then
        log "WARN" "Found $warn_count warnings in the last hour"
    else
        log "SUCCESS" "No recent errors or warnings"
    fi
    
    return 0
}

generate_health_report() {
    local report_file="${PROJECT_ROOT}/logs/health_report.json"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # Create report structure
    cat > "$report_file" << EOF
{
    "timestamp": "$timestamp",
    "services": {
        "backend": {
            "status": "$(check_backend >/dev/null && echo "healthy" || echo "unhealthy")",
            "port": ${BACKEND_PORT}
        },
        "frontend": {
            "status": "$(check_frontend >/dev/null && echo "healthy" || echo "unhealthy")",
            "port": ${FRONTEND_PORT}
        }
    },
    "system": {
        "disk_usage": "$(df -h . | awk 'NR==2 {print $5}')",
        "memory_available": "$(free -m 2>/dev/null | awk '/Mem:/ {print $7}' || echo "N/A")MB"
    },
    "logs": {
        "error_count": $(find "${PROJECT_ROOT}/logs" -name "*.log" -mmin -60 -exec grep -c "\[ERROR\]" {} \; 2>/dev/null || echo "0"),
        "warning_count": $(find "${PROJECT_ROOT}/logs" -name "*.log" -mmin -60 -exec grep -c "\[WARN\]" {} \; 2>/dev/null || echo "0")
    }
}
EOF
    
    log "SUCCESS" "Health report generated: $report_file"
}

# Main health check function
check_health() {
    local failed=0
    
    # Run all health checks
    check_backend || failed=$((failed + 1))
    check_frontend || failed=$((failed + 1))
    check_system_resources || failed=$((failed + 1))
    check_log_health || failed=$((failed + 1))
    
    # Generate health report
    generate_health_report
    
    if [[ $failed -gt 0 ]]; then
        log "ERROR" "$failed health checks failed"
        return 1
    else
        log "SUCCESS" "All health checks passed"
        return 0
    fi
}

# Export functions for use by other scripts
export -f check_health check_backend check_frontend check_system_resources check_log_health 