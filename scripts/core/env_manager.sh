#!/bin/bash

# env_manager.sh - Enhanced Environment Management
# Author: Senior Developer
# Version: 2.0.0
# Last Updated: 2025-02-13

# Strict error handling
set -euo pipefail

# Detect shell type and set appropriate options
if [ -n "${ZSH_VERSION:-}" ]; then
    SHELL_TYPE="zsh"
    setopt NULL_GLOB
elif [ -n "${BASH_VERSION:-}" ]; then
    SHELL_TYPE="bash"
    shopt -s nullglob
else
    SHELL_TYPE="unknown"
fi

# Core configuration
VENV_DIR="${PROJECT_ROOT}/backend/.venv"
LOG_DIR="${PROJECT_ROOT}/logs"
MIN_PYTHON_VERSION="3.12.0"
MIN_NODE_VERSION="18.0.0"

# Visual feedback for better UX
ERROR_PREFIX="🚫"
SUCCESS_PREFIX="✅"
INFO_PREFIX="ℹ️"
WARN_PREFIX="⚠️"

# Logging setup
setup_logging() {
    mkdir -p "${LOG_DIR}"
    local log_file="${LOG_DIR}/environment.log"
    local max_size=$((10 * 1024 * 1024))  # 10MB
    
    if [ -f "${log_file}" ] && [ "$(stat -f%z "${log_file}")" -gt "${max_size}" ]; then
        mv "${log_file}" "${log_file}.old"
    fi
    
    # Export for use by other functions
    export MAM_LOG_FILE="${log_file}"
}

log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] [${level}] ${message}" >> "${MAM_LOG_FILE}"
    
    # Terminal output with color
    case "${level}" in
        "ERROR") echo "${ERROR_PREFIX} ${message}" ;;
        "SUCCESS") echo "${SUCCESS_PREFIX} ${message}" ;;
        "WARN") echo "${WARN_PREFIX} ${message}" ;;
        *) echo "${INFO_PREFIX} ${message}" ;;
    esac
}

verify_venv() {
    log "INFO" "Verifying virtual environment..."
    
    # Check if we're already in a virtual environment
    if [ -n "${VIRTUAL_ENV:-}" ]; then
        # If we're in Cursor's environment, just use it
        if [[ "$VIRTUAL_ENV" == *"/venv" ]]; then
            log "SUCCESS" "Using Cursor's virtual environment: ${VIRTUAL_ENV}"
            return 0
        elif [ "${VIRTUAL_ENV}" != "${VENV_DIR}" ]; then
            log "WARN" "Using different virtual environment: ${VIRTUAL_ENV}"
            log "INFO" "This is OK in development, but use ${VENV_DIR} in production"
            return 0
        fi
        log "SUCCESS" "Using project virtual environment: ${VIRTUAL_ENV}"
        return 0
    fi
    
    # No virtual environment active, create one
    if [ ! -d "${VENV_DIR}" ]; then
        log "INFO" "Creating virtual environment in ${VENV_DIR}..."
        python3 -m venv "${VENV_DIR}"
        log "SUCCESS" "Virtual environment created"
    fi
    
    # Activate virtual environment
    source "${VENV_DIR}/bin/activate"
    
    # Verify activation
    if [ "${VIRTUAL_ENV}" != "${VENV_DIR}" ]; then
        log "ERROR" "Failed to activate virtual environment"
        return 1
    fi
    
    log "SUCCESS" "Virtual environment verified and active"
    return 0
}

verify_python_version() {
    log "INFO" "Verifying Python version..."
    
    if ! command -v python3 >/dev/null; then
        log "ERROR" "Python 3 not found"
        return 1
    fi
    
    local version=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
    if ! awk -v ver="$version" -v req="$MIN_PYTHON_VERSION" 'BEGIN {exit !(ver >= req)}'; then
        log "ERROR" "Python ${MIN_PYTHON_VERSION}+ required, found ${version}"
        return 1
    fi
    
    log "SUCCESS" "Python version verified: ${version}"
    return 0
}

verify_node_version() {
    log "INFO" "Verifying Node.js version..."
    
    if ! command -v node >/dev/null; then
        log "ERROR" "Node.js not found"
        return 1
    fi
    
    local version=$(node -v | cut -d'v' -f2)
    if ! awk -v ver="$version" -v req="$MIN_NODE_VERSION" 'BEGIN {exit !(ver >= req)}'; then
        log "ERROR" "Node.js ${MIN_NODE_VERSION}+ required, found ${version}"
        return 1
    fi
    
    log "SUCCESS" "Node.js version verified: ${version}"
    return 0
}

verify_directory_structure() {
    log "INFO" "Verifying project structure..."
    
    local required_dirs=(
        "backend"
        "frontend"
        "data"
        "logs"
        "scripts/core"
    )
    
    local missing=0
    for dir in "${required_dirs[@]}"; do
        if [ ! -d "${PROJECT_ROOT}/${dir}" ]; then
            log "ERROR" "Missing required directory: ${dir}"
            missing=$((missing + 1))
        fi
    done
    
    if [ $missing -gt 0 ]; then
        log "ERROR" "Project structure verification failed"
        return 1
    fi
    
    log "SUCCESS" "Project structure verified"
    return 0
}

setup_python_env() {
    log "INFO" "Setting up Python environment..."
    
    # Activate virtual environment
    verify_venv || return 1
    
    # Upgrade pip
    python3 -m pip install --upgrade pip
    
    # Install requirements if they exist
    if [ -f "${PROJECT_ROOT}/backend/requirements.txt" ]; then
        log "INFO" "Installing Python dependencies..."
        pip install -r "${PROJECT_ROOT}/backend/requirements.txt"
    fi
    
    # Set PYTHONPATH
    export PYTHONPATH="${PROJECT_ROOT}/backend:${PYTHONPATH:-}"
    
    log "SUCCESS" "Python environment setup complete"
    return 0
}

setup_node_env() {
    log "INFO" "Setting up Node.js environment..."
    
    cd "${PROJECT_ROOT}/frontend"
    
    if [ -f "package.json" ]; then
        log "INFO" "Installing Node.js dependencies..."
        npm install
    fi
    
    cd "${PROJECT_ROOT}"
    log "SUCCESS" "Node.js environment setup complete"
    return 0
}

# Main environment management function
manage_environment() {
    setup_logging
    
    log "INFO" "Starting environment verification..."
    
    # Run all verifications
    verify_python_version || return 1
    verify_node_version || return 1
    verify_directory_structure || return 1
    setup_python_env || return 1
    setup_node_env || return 1
    
    log "SUCCESS" "Environment verification complete"
    return 0
}

# Export functions for use by other scripts
export -f manage_environment verify_venv

# Execute if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    manage_environment
fi 