#!/bin/bash
# ==============================================================================
# MAM Virtual Environment Manager Test Suite
# ==============================================================================
# Comprehensive test suite for venv_manager.sh
# Run with: bash test_venv.sh
# ==============================================================================

source ../venv_manager.sh

# =====================================
# Test Utilities
# =====================================
TEST_COUNT=0
PASS_COUNT=0
FAIL_COUNT=0

assert() {
    local condition="$1"
    local message="$2"
    ((TEST_COUNT++))
    
    if eval "$condition"; then
        echo "${SUCCESS_PREFIX} Test passed: ${message}"
        ((PASS_COUNT++))
    else
        echo "${ERROR_PREFIX} Test failed: ${message}"
        ((FAIL_COUNT++))
    fi
}

setup() {
    # Create temporary test environment
    TEST_DIR=$(mktemp -d)
    cd "${TEST_DIR}"
    git init > /dev/null
    mkdir -p backend
    touch backend/requirements.txt
}

teardown() {
    # Clean up test environment
    rm -rf "${TEST_DIR}"
}

# =====================================
# Test Cases
# =====================================
test_python_version() {
    setup
    # Test valid Python version
    assert "check_python_version" "Should accept valid Python version"
    
    # Test invalid Python version (simulate by modifying MIN_PYTHON_VERSION)
    local OLD_MIN_VERSION="${MIN_PYTHON_VERSION}"
    MIN_PYTHON_VERSION="999.999.999"
    ! check_python_version
    assert "[[ $? -eq 1 ]]" "Should reject invalid Python version"
    MIN_PYTHON_VERSION="${OLD_MIN_VERSION}"
    
    teardown
}

test_environment_validation() {
    setup
    # Test with all requirements met
    assert "validate_environment" "Should validate complete environment"
    
    # Test with missing tool (simulate by modifying PATH)
    local OLD_PATH="${PATH}"
    PATH=""
    ! validate_environment
    assert "[[ $? -eq 1 ]]" "Should detect missing tools"
    PATH="${OLD_PATH}"
    
    teardown
}

test_project_detection() {
    setup
    assert "is_in_project" "Should detect MAM project structure"
    assert "[[ $(get_project_root) == ${TEST_DIR} ]]" "Should return correct project root"
    teardown
}

test_venv_path() {
    setup
    local expected_path="${TEST_DIR}/backend/${VENV_NAME}"
    assert "[[ $(find_venv) == ${expected_path} ]]" "Should return correct venv path"
    teardown
}

test_clean_environment() {
    setup
    # Simulate active environment
    export VIRTUAL_ENV="fake/path"
    clean_env
    assert "[[ -z ${VIRTUAL_ENV:-} ]]" "Should clean existing environment"
    teardown
}

test_activation() {
    setup
    mkdir -p "backend/${VENV_NAME}/bin"
    touch "backend/${VENV_NAME}/bin/activate"
    
    # Test normal activation
    activate_venv
    assert "[[ -n ${VIRTUAL_ENV:-} ]]" "Should set VIRTUAL_ENV"
    assert "[[ -n ${PROJECT_ROOT:-} ]]" "Should set PROJECT_ROOT"
    
    # Test force activation
    export VIRTUAL_ENV="fake/path"
    activate_venv --force
    assert "[[ ${VIRTUAL_ENV} != fake/path ]]" "Should force new environment"
    
    teardown
}

test_logging() {
    setup
    local test_message="Test log entry"
    log "TEST" "${test_message}"
    assert "grep -q '${test_message}' '${LOG_FILE}'" "Should write to log file"
    teardown
}

# =====================================
# Run Test Suite
# =====================================
run_tests() {
    echo "Running MAM Virtual Environment Manager tests..."
    echo "=============================================="
    
    test_python_version
    test_environment_validation
    test_project_detection
    test_venv_path
    test_clean_environment
    test_activation
    test_logging
    
    echo "=============================================="
    echo "Tests completed: ${TEST_COUNT}"
    echo "Passed: ${PASS_COUNT}"
    echo "Failed: ${FAIL_COUNT}"
    
    return $((FAIL_COUNT > 0))
}

# Run the tests
run_tests 