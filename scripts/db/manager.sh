#!/bin/bash

# Database management script for MAM application
# Author: Senior Developer
# Version: 2.0.0
# Last Updated: 2025-02-13

# Strict error handling
set -euo pipefail

# Get absolute paths
readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

# Source core utilities
source "${PROJECT_ROOT}/scripts/core/service_manager.sh"

# Database operations
init_db() {
    log "INFO" "Initializing database..."
    "${PROJECT_ROOT}/scripts/db/init.py"
}

merge_db() {
    local source_db=$1
    log "INFO" "Merging database from: $source_db"
    "${PROJECT_ROOT}/scripts/db/merge.py" "$source_db"
}

backup_db() {
    local backup_dir="${PROJECT_ROOT}/data/backups"
    mkdir -p "$backup_dir"
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${backup_dir}/db_backup_${timestamp}.db"
    
    log "INFO" "Creating database backup: $backup_file"
    cp "${PROJECT_ROOT}/data/merged.db" "$backup_file"
    
    # Keep only last 5 backups
    ls -t "${backup_dir}"/*.db | tail -n +6 | xargs rm -f 2>/dev/null || true
}

verify_db() {
    log "INFO" "Verifying database integrity..."
    sqlite3 "${PROJECT_ROOT}/data/merged.db" "PRAGMA integrity_check;"
}

# Main function
main() {
    local command=$1
    shift
    
    case $command in
        init)
            init_db
            ;;
        merge)
            if [[ $# -lt 1 ]]; then
                log "ERROR" "Usage: db merge <source_db_path>"
                exit 1
            fi
            merge_db "$1"
            ;;
        backup)
            backup_db
            ;;
        verify)
            verify_db
            ;;
        *)
            log "ERROR" "Unknown command: $command"
            echo "Usage: db <init|merge|backup|verify>"
            exit 1
            ;;
    esac
}

# Execute if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ $# -eq 0 ]]; then
        echo "Usage: db <init|merge|backup|verify>"
        exit 1
    fi
    main "$@"
fi 