# Virtual Environment Management

## Overview

The MAM project uses a sophisticated virtual environment management system to prevent common issues like nested environments and ensure consistent development environments across the team.

## Features

- 🔒 Prevents nested virtual environment activations
- 📁 Project-aware environment detection
- 📝 Comprehensive logging system
- 🔄 Automatic log rotation
- 🛠️ IDE integration support
- ✨ Shell completion
- 📊 Environment status monitoring
- 🔍 Automatic environment validation
- 🐍 Python version checking

## Requirements

- Python 3.11+
- Git
- Node.js & npm
- pip

The system automatically validates these requirements before activation.

## Quick Start

```bash
# Add to your shell configuration (~/.zshrc or ~/.bashrc):
source /path/to/mam-poc/scripts/env/venv_manager.sh

# Basic usage:
av              # Activate virtual environment
av!             # Force clean activation
venv-status     # Check current environment
venv-log        # View environment logs
```

## Detailed Usage

### Basic Commands

- `av` - Activate project's virtual environment
- `av!` - Force activate (clean existing environments)
- `deactivate` - Exit the virtual environment
- `venv-status` - Display current environment status
- `venv-log` - View environment logs

### Advanced Usage

```bash
# Full command with options
activate_venv --help
activate_venv --force

# Check environment logs
tail -f ~/.mam/venv.log
```

## IDE Integration

### VS Code

Add to `.vscode/settings.json`:
```json
{
    "python.defaultInterpreterPath": "${workspaceFolder}/backend/.venv/bin/python",
    "python.terminal.activateEnvironment": true,
    "terminal.integrated.env.osx": {
        "PYTHONPATH": "${workspaceFolder}/backend"
    }
}
```

### PyCharm

1. Open Project Settings (⌘,)
2. Go to Project > Python Interpreter
3. Add Interpreter > Existing Environment
4. Select `/path/to/mam-poc/backend/.venv/bin/python`

## Troubleshooting

### Common Issues

1. Multiple Environment Prefixes
   ```bash
   # If you see multiple (venv) prefixes:
   av!  # This will clean and reactivate
   ```

2. Environment Not Found
   ```bash
   # Ensure you're in the project directory:
   cd /path/to/mam-poc
   av
   ```

3. Python Path Issues
   ```bash
   # Check PYTHONPATH:
   echo $PYTHONPATH
   
   # Should include project root:
   venv-status
   ```

### Logging

The system maintains logs at `~/.mam/venv.log`:
- Automatic rotation at 10MB
- Timestamps for all events
- Different log levels (INFO, WARNING, ERROR, DEBUG)

View logs with:
```bash
venv-log
# or
tail -f ~/.mam/venv.log
```

## Best Practices

1. **Always use provided commands**
   - Use `av` instead of direct `source` commands
   - Use `av!` when switching branches
   - Use `venv-status` to verify environment

2. **Environment Switching**
   - Always use `av!` when switching branches
   - Check status after switching with `venv-status`
   - Review logs if issues occur with `venv-log`

3. **Project Structure**
   - Keep virtual environment in `backend/.venv`
   - Don't create multiple environments
   - Use project root as working directory

## Development

### Running Tests

```bash
cd scripts/env/tests
bash test_venv.sh
```

### Adding New Features

1. Update `venv_manager.sh`
2. Add tests in `test_venv.sh`
3. Update documentation
4. Run test suite
5. Commit changes

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new features
4. Update documentation
5. Submit pull request

## Support

- Check logs: `venv-log`
- Review documentation
- Open GitHub issue
- Contact development team

## Environment Validation

The system performs automatic environment validation:

1. **Python Version Check**
   ```bash
   # Ensures Python 3.11+ is installed
   python3 --version
   ```

2. **Required Tools**
   - Git (for project detection)
   - pip (for package management)
   - Node.js & npm (for frontend)

3. **Environment Variables**
   - HOME
   - PYTHONPATH (set automatically)
   - PROJECT_ROOT (set automatically)

If any validation fails, clear error messages will guide you to fix the issues. 