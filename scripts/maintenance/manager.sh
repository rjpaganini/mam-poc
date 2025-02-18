#!/bin/bash

# Maintenance management script for MAM application
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

# Maintenance operations
regenerate_thumbnails() {
    log "INFO" "Regenerating thumbnails..."
    "${PROJECT_ROOT}/scripts/maintenance/thumbnails.py"
}

check_durations() {
    log "INFO" "Checking media durations..."
    "${PROJECT_ROOT}/scripts/maintenance/durations.py"
}

cleanup_temp_files() {
    log "INFO" "Cleaning up temporary files..."
    find "${PROJECT_ROOT}/data/temp" -type f -mtime +7 -delete
    find "${PROJECT_ROOT}/logs" -type f -name "*.log" -mtime +30 -delete
}

verify_media_files() {
    log "INFO" "Verifying media files..."
    local media_dir="${PROJECT_ROOT}/data/media"
    
    # Check for broken symlinks
    find "$media_dir" -type l ! -exec test -e {} \; -print | while read -r broken_link; do
        log "WARN" "Found broken symlink: $broken_link"
    done
    
    # Check file permissions
    find "$media_dir" -type f ! -perm -u=r -print | while read -r unreadable_file; do
        log "WARN" "Found unreadable file: $unreadable_file"
    done
}

# Main function
main() {
    local command=$1
    shift
    
    case $command in
        thumbnails)
            regenerate_thumbnails
            ;;
        durations)
            check_durations
            ;;
        cleanup)
            cleanup_temp_files
            ;;
        verify)
            verify_media_files
            ;;
        all)
            regenerate_thumbnails
            check_durations
            cleanup_temp_files
            verify_media_files
            ;;
        *)
            log "ERROR" "Unknown command: $command"
            echo "Usage: maintenance <thumbnails|durations|cleanup|verify|all>"
            exit 1
            ;;
    esac
}

# Execute if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ $# -eq 0 ]]; then
        echo "Usage: maintenance <thumbnails|durations|cleanup|verify|all>"
        exit 1
    fi
    main "$@"
fi 