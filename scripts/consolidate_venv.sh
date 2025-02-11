#!/bin/bash

# consolidate_venv.sh
# Script to safely consolidate multiple virtual environments into a single .venv
# Version: 1.0.2
# Author: Claude
# Date: 2024-02-07

set -e  # Exit on error

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'  # No Color

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Log file setup
LOG_DIR="${PROJECT_ROOT}/logs"
LOG_FILE="${LOG_DIR}/venv_consolidation.log"
mkdir -p "$LOG_DIR"

# Logging function
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "${timestamp} [${level}] ${message}" >> "$LOG_FILE"
    case $level in
        "ERROR") echo -e "${RED}[ERROR] ${message}${NC}" ;;
        "SUCCESS") echo -e "${GREEN}[SUCCESS] ${message}${NC}" ;;
        "WARN") echo -e "${YELLOW}[WARN] ${message}${NC}" ;;
        "INFO") echo -e "${BLUE}[INFO] ${message}${NC}" ;;
    esac
}

log "INFO" "Starting virtual environment consolidation..."

# Check Python version
REQUIRED_PYTHON="3.11"
PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')

if (( $(echo "$PYTHON_VERSION < 3.11" | bc -l) )); then
    log "ERROR" "Python $REQUIRED_PYTHON or higher is required (found $PYTHON_VERSION)"
    exit 1
fi

# Create backup timestamp
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/venv_backup_${BACKUP_TIMESTAMP}"

# Backup existing environments
log "INFO" "Creating backup of existing environments..."
mkdir -p "$BACKUP_DIR"

# Function to backup venv if it exists
backup_venv() {
    local src=$1
    local dest=$2
    if [[ -d "$src" ]]; then
        log "INFO" "Backing up $src to $dest"
        cp -R "$src" "$dest"
        return 0
    fi
    return 1
}

# Backup all possible venv locations
backup_venv "venv" "$BACKUP_DIR/venv_root"
backup_venv "backend/venv" "$BACKUP_DIR/venv_backend"
backup_venv "backend/.venv" "$BACKUP_DIR/venv_backend_dot"

# Remove existing environments with confirmation
log "WARN" "About to remove existing virtual environments"
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "INFO" "Removing existing virtual environments..."
    rm -rf venv backend/venv backend/.venv
else
    log "INFO" "Operation cancelled by user"
    exit 0
fi

# Create new unified environment
log "INFO" "Creating new unified virtual environment..."
cd backend
python3 -m venv .venv

# Activate the new environment
source .venv/bin/activate

# Verify activation
if [[ -z "${VIRTUAL_ENV}" ]]; then
    log "ERROR" "Failed to activate virtual environment"
    exit 1
fi

# Upgrade pip
log "INFO" "Upgrading pip..."
python -m pip install --upgrade pip

# Install dependencies with error handling
log "INFO" "Installing dependencies..."
if ! pip install -r requirements.txt; then
    log "ERROR" "Failed to install dependencies"
    exit 1
fi

# Create symbolic link in project root
log "INFO" "Creating symbolic link in project root..."
cd "$PROJECT_ROOT"
if [[ -L ".venv" ]]; then
    rm .venv
fi
ln -s backend/.venv .venv

# Verify the setup
if [[ -d "backend/.venv" ]] && [[ -L ".venv" ]] && [[ -f "backend/.venv/bin/activate" ]]; then
    log "SUCCESS" "Virtual environment consolidation complete!"
    log "INFO" "Backup created at: ${BACKUP_DIR}"
    log "INFO" "New virtual environment location: backend/.venv"
    log "INFO" "Symbolic link created at: .venv"
    
    # Print activation instructions
    echo -e "\n${GREEN}To activate the new environment:${NC}"
    echo "source backend/.venv/bin/activate  # From backend directory"
    echo "source .venv/bin/activate          # From project root"
else
    log "ERROR" "Setup verification failed"
    exit 1
fi 