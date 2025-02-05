#!/bin/bash

# consolidate_venv.sh
# Script to safely consolidate multiple virtual environments into a single .venv
# Author: Claude
# Date: 2024-02-03

set -e  # Exit on error

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'  # No Color

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BLUE}Starting virtual environment consolidation...${NC}"

# Create backup timestamp
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/venv_backup_${BACKUP_TIMESTAMP}"

# Backup existing environments
echo -e "${BLUE}Creating backup of existing environments...${NC}"
mkdir -p "$BACKUP_DIR"
[ -d "venv" ] && cp -R venv "$BACKUP_DIR/venv_root"
[ -d "backend/venv" ] && cp -R backend/venv "$BACKUP_DIR/venv_backend"
[ -d "backend/.venv" ] && cp -R backend/.venv "$BACKUP_DIR/venv_backend_dot"

# Remove existing environments
echo -e "${BLUE}Removing existing virtual environments...${NC}"
rm -rf venv backend/venv backend/.venv

# Create new unified environment
echo -e "${BLUE}Creating new unified virtual environment...${NC}"
cd backend
python3.11 -m venv .venv
source .venv/bin/activate

# Upgrade pip
echo -e "${BLUE}Upgrading pip...${NC}"
pip install --upgrade pip

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
pip install -r requirements.txt

# Create symbolic link in project root
echo -e "${BLUE}Creating symbolic link in project root...${NC}"
cd "$PROJECT_ROOT"
ln -s backend/.venv .venv

echo -e "${GREEN}Virtual environment consolidation complete!${NC}"
echo -e "${BLUE}Backup created at: ${BACKUP_DIR}${NC}"
echo -e "${BLUE}New virtual environment location: backend/.venv${NC}"
echo -e "${BLUE}Symbolic link created at: .venv${NC}"

# Print activation instructions
echo -e "\n${GREEN}To activate the new environment:${NC}"
echo "source backend/.venv/bin/activate  # From backend directory"
echo "source .venv/bin/activate          # From project root" 