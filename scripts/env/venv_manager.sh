#!/bin/bash
# ==============================================================================
# MAM Virtual Environment Manager v1.0.2
# ==============================================================================
# Robust virtual environment management for the MAM project
# Features:
#   - Prevents nested environments
#   - Project-aware activation
#   - Comprehensive environment validation
#   - Python version and symlink verification
#   - Shell-agnostic compatibility
# ==============================================================================

# Detect shell type and set appropriate options
if [ -n "$ZSH_VERSION" ]; then
    SHELL_TYPE="zsh"
    setopt NULL_GLOB  # Prevent errors on no matches
    setopt LOCAL_OPTIONS  # Prevent option leakage
elif [ -n "$BASH_VERSION" ]; then
    SHELL_TYPE="bash"
    shopt -s nullglob  # Prevent errors on no matches
else
    SHELL_TYPE="unknown"
fi

set -euo pipefail  # Strict error handling

# =====================================
# Configuration
# =====================================
VENV_NAME=".venv"
MAX_DIR_DEPTH=2
LOG_FILE="${HOME}/.mam/venv.log"
LOG_MAX_SIZE=$((10 * 1024 * 1024))  # 10MB
MIN_PYTHON_VERSION="3.11.0"

# Visual feedback
ERROR_PREFIX="🚫"
SUCCESS_PREFIX="✅"
INFO_PREFIX="ℹ️"
DEBUG_PREFIX="🔍"
WARN_PREFIX="⚠️"

# =====================================
# Logging
# =====================================
mam_log() {
    _level="$1"
    _message="$2"
    _timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    _log_dir=$(dirname "${LOG_FILE}")
    
    mkdir -p "${_log_dir}"
    
    if [ -f "${LOG_FILE}" ] && [ "$(stat -f%z "${LOG_FILE}")" -gt "${LOG_MAX_SIZE}" ]; then
        mv "${LOG_FILE}" "${LOG_FILE}.old"
    fi
    
    echo "[${_timestamp}] [${_level}] ${_message}" >> "${LOG_FILE}"
}

# =====================================
# Environment Checks
# =====================================
check_multiple_activations() {
    # Count (venv) or (.venv) occurrences in PS1/prompt
    _count=0
    if [ "${SHELL_TYPE}" = "zsh" ]; then
        _count=$(echo "${PROMPT:-}" | grep -o "(\.*venv)" | wc -l)
    else
        _count=$(echo "${PS1:-}" | grep -o "(\.*venv)" | wc -l)
    fi
    
    if [ "${_count}" -gt 1 ]; then
        echo "${WARN_PREFIX} Multiple virtual environments detected in prompt"
        return 1
    fi
    return 0
}

verify_python_symlinks() {
    _venv_path="$1"
    _python_path="${_venv_path}/bin/python"
    
    # Check if Python is properly symlinked
    if [ -L "${_python_path}" ]; then
        _target=$(readlink -f "${_python_path}")
        if ! echo "${_target}" | grep -q "python3\.11"; then
            echo "${ERROR_PREFIX} Invalid Python symlink: ${_target}"
            return 1
        fi
    else
        echo "${ERROR_PREFIX} Python is not properly symlinked in venv"
        return 1
    fi
    return 0
}

verify_environment() {
    _venv_path="$1"
    
    # Check Python version
    if ! "${_venv_path}/bin/python" --version 2>&1 | grep -q "Python 3\.11"; then
        echo "${ERROR_PREFIX} Wrong Python version in venv"
        return 1
    fi
    
    # Verify pip is installed
    if ! "${_venv_path}/bin/pip" --version >/dev/null 2>&1; then
        echo "${ERROR_PREFIX} pip not found in venv"
        return 1
    fi
    
    # Check PYTHONPATH
    if [ -n "${PYTHONPATH:-}" ]; then
        if ! echo "${PYTHONPATH}" | grep -q "${PROJECT_ROOT:-}"; then
            echo "${WARN_PREFIX} PYTHONPATH does not include project root"
            return 1
        fi
    fi
    
    return 0
}

# =====================================
# Environment Validation
# =====================================
validate_environment() {
    _issues=""
    
    # Check Python version
    if ! command -v python3 >/dev/null 2>&1; then
        echo "${ERROR_PREFIX} Python 3 not found"
        return 1
    fi
    
    _current_version=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:3])))')
    
    # Version comparison without arrays (zsh compatible)
    if ! python3 -c "import sys; exit(0 if tuple(map(int, '${_current_version}'.split('.'))) >= tuple(map(int, '${MIN_PYTHON_VERSION}'.split('.'))) else 1)"; then
        echo "${ERROR_PREFIX} Python ${MIN_PYTHON_VERSION}+ required, found ${_current_version}"
        return 1
    fi
    
    # Check required tools
    for tool in git pip node npm; do
        if ! command -v $tool >/dev/null 2>&1; then
            _issues="${_issues}${WARN_PREFIX} Missing required tool: $tool\n"
        fi
    done
    
    # Check environment variables
    if [ -z "${HOME:-}" ]; then
        _issues="${_issues}${WARN_PREFIX} HOME environment variable not set\n"
    fi
    
    if [ -n "${_issues}" ]; then
        echo "${ERROR_PREFIX} Environment validation failed:"
        echo -e "${_issues}"
        return 1
    fi
    return 0
}

# =====================================
# Environment Detection
# =====================================
is_in_project() {
    git rev-parse --git-dir >/dev/null 2>&1 && \
    [ -f "$(git rev-parse --show-toplevel)/backend/requirements.txt" ]
}

get_project_root() {
    if is_in_project; then
        git rev-parse --show-toplevel
    else
        return 1
    fi
}

# =====================================
# Environment Management
# =====================================
find_venv() {
    _project_root=$(get_project_root)
    if [ $? -eq 0 ]; then
        echo "${_project_root}/backend/${VENV_NAME}"
        return 0
    fi
    
    mam_log "ERROR" "Not in a MAM project directory"
    return 1
}

clean_env() {
    mam_log "INFO" "Cleaning virtual environment"
    
    # Deactivate any active environments
    while command -v deactivate >/dev/null 2>&1; do
        deactivate
        mam_log "DEBUG" "Deactivated environment"
    done
    
    # Clear any environment variables
    unset VIRTUAL_ENV PYTHONPATH PROJECT_ROOT 2>/dev/null || true
    
    # Verify cleanup
    if check_multiple_activations; then
        mam_log "INFO" "Environment cleaned successfully"
        return 0
    else
        mam_log "ERROR" "Failed to clean environment completely"
        return 1
    fi
}

activate_venv() {
    _force=0
    
    # Parse arguments
    while [ $# -gt 0 ]; do
        case "$1" in
            --force) _force=1; shift ;;
            *) echo "Unknown option: $1"; return 1 ;;
        esac
    done
    
    # Force activation handling
    if [ "${_force}" -eq 1 ]; then
        clean_env
    elif [ -n "${VIRTUAL_ENV:-}" ]; then
        echo "${ERROR_PREFIX} Already in virtual environment: ${VIRTUAL_ENV}"
        echo "${INFO_PREFIX} Use 'av!' to switch environments"
        return 1
    fi

    # Find and activate
    _venv_path=$(find_venv)
    if [ $? -ne 0 ]; then
        echo "${ERROR_PREFIX} Not in a MAM project directory"
        return 1
    fi

    # Verify virtual environment
    if ! verify_python_symlinks "${_venv_path}"; then
        echo "${ERROR_PREFIX} Invalid virtual environment setup"
        return 1
    fi

    # Activate environment
    . "${_venv_path}/bin/activate"
    
    # Verify activation and setup
    if ! verify_environment "${_venv_path}"; then
        echo "${ERROR_PREFIX} Environment verification failed"
        clean_env
        return 1
    fi

    # Set project variables
    export PROJECT_ROOT=$(dirname "${_venv_path}")
    export MAM_ENV="development"
    export PYTHONPATH="${PROJECT_ROOT}:${PYTHONPATH:-}"

    echo "${SUCCESS_PREFIX} Activated: ${_venv_path}"
    mam_log "INFO" "Environment activated and verified"
    return 0
}

# =====================================
# Shell Integration
# =====================================
if [ "${SHELL_TYPE}" = "bash" ]; then
    _activate_venv_completion() {
        cur="${COMP_WORDS[COMP_CWORD]}"
        opts="--force --help"
        COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
    }
    complete -F _activate_venv_completion activate_venv
elif [ "${SHELL_TYPE}" = "zsh" ]; then
    # ZSH completion
    _activate_venv_completion() {
        local -a opts
        opts=(
            '--force:Force clean activation'
            '--help:Show help'
        )
        _describe 'activate_venv' opts
    }
    compdef _activate_venv_completion activate_venv 2>/dev/null || true
fi

# =====================================
# Enhanced Status Command
# =====================================
venv_status() {
    echo "${INFO_PREFIX} Environment Status:"
    echo "├── Virtual Env: ${VIRTUAL_ENV:-none}"
    echo "├── Python: $(which python 2>/dev/null || echo 'none')"
    echo "├── Version: $(python --version 2>/dev/null || echo 'none')"
    echo "├── Project Root: ${PROJECT_ROOT:-none}"
    echo "└── PYTHONPATH: ${PYTHONPATH:-none}"
}

# =====================================
# Aliases and Functions
# =====================================
# Define functions first (more reliable than aliases in zsh)
av() {
    activate_venv "$@"
}

av_force() {
    activate_venv --force
}

venv_log() {
    tail -f "${LOG_FILE}"
}

# Set aliases if shell supports them
if [ "${SHELL_TYPE}" = "bash" ] || [ "${SHELL_TYPE}" = "zsh" ]; then
    alias av!='av_force'
    alias venv-status='venv_status'
    alias venv-log='venv_log'
fi

# Export for subprocesses (only if bash)
if [ "${SHELL_TYPE}" = "bash" ]; then
    export -f activate_venv clean_env find_venv
fi 