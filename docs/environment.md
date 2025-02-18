# Environment Management

## Overview

The MAM project uses a robust environment management system that ensures:
- Consistent virtual environment usage
- Correct Python and Node.js versions
- Proper directory structure
- Required dependencies

## Quick Start

```bash
# Start a new session
./scripts/mam start

# Check environment
./scripts/mam env check

# The system will automatically:
# 1. Verify/create virtual environment
# 2. Check Python/Node.js versions
# 3. Install dependencies
# 4. Set up PYTHONPATH
```

## Service Management

The `mam` script provides comprehensive service management:

```bash
# Start services
./scripts/mam start              # Start all services
./scripts/mam start backend      # Start backend only
./scripts/mam start frontend     # Start frontend only
./scripts/mam start electron     # Start Electron app

# Stop services
./scripts/mam stop               # Stop all services
./scripts/mam stop backend       # Stop backend only

# Restart services
./scripts/mam restart            # Restart all services
./scripts/mam restart frontend   # Restart frontend only

# Check status
./scripts/mam status             # Check all services
./scripts/mam health             # Detailed health check
```

## Maintenance Operations

```bash
# Database operations
./scripts/mam db init           # Initialize database
./scripts/mam db verify         # Check integrity
./scripts/mam db backup         # Create backup
./scripts/mam db merge <path>   # Merge from path

# Asset maintenance
./scripts/mam maint thumbnails  # Regenerate thumbnails
./scripts/mam maint durations   # Check media durations
./scripts/mam maint cleanup     # Clean temp files
./scripts/mam maint verify      # Verify media files
```

## Logging

View service logs with:
```bash
./scripts/mam logs              # View all logs
./scripts/mam logs backend      # Backend logs only
./scripts/mam logs frontend     # Frontend logs only
```

Logs are stored in `logs/` with automatic rotation:
- `backend.log` - Backend service logs
- `frontend.log` - Frontend service logs
- `electron.log` - Electron app logs
- `environment.log` - Environment management logs
- `health_report.json` - Latest health check results

## Virtual Environment

The system maintains a single virtual environment at `backend/.venv`:
```bash
# Environment is managed automatically by mam script
# Manual activation if needed:
source backend/.venv/bin/activate
```

### Key Features
- Prevents nested environments
- Automatic activation
- Version verification
- Dependency management
- Comprehensive logging

## Requirements

- Python 3.12+
- Node.js 18.0+
- Git
- SQLite 3.x

## Directory Structure

```
mam-poc/
├── backend/         # Flask backend
│   └── .venv/      # Python virtual environment
├── frontend/       # React frontend
├── data/          # Database and assets
├── logs/          # Log files
└── scripts/       # Utility scripts
    ├── core/      # Core management scripts
    ├── db/        # Database utilities
    └── maint/     # Maintenance tools
```

## Environment Variables

The system manages:
- `PYTHONPATH` - Set to include backend directory
- `VIRTUAL_ENV` - Points to active virtual environment
- `PROJECT_ROOT` - Base project directory

## Common Issues

1. **Service Won't Start**
   ```bash
   # Check service status
   ./scripts/mam status
   
   # View service logs
   ./scripts/mam logs backend
   ```

2. **Wrong Virtual Environment**
   ```bash
   # Check environment
   ./scripts/mam env check
   ```

3. **Missing Dependencies**
   ```bash
   # Verify environment setup
   ./scripts/mam env setup
   ```

## Best Practices

1. **Always Use MAM Script**
   - Use `./scripts/mam start` to start services
   - Let the system manage the environment
   - Use built-in commands for all operations

2. **Check Health Regularly**
   ```bash
   ./scripts/mam health  # Full health check
   ```

3. **Monitor Logs**
   ```bash
   ./scripts/mam logs    # View all logs
   ```

## Development Workflow

1. **Start New Session**
   ```bash
   ./scripts/mam start
   ```

2. **Monitor Services**
   ```bash
   ./scripts/mam status
   ```

3. **View Logs**
   ```bash
   ./scripts/mam logs
   ```

## IDE Integration

### VS Code
```json
{
    "python.defaultInterpreterPath": "${workspaceFolder}/backend/.venv/bin/python",
    "python.terminal.activateEnvironment": true
}
```

### PyCharm
- Set interpreter to `backend/.venv/bin/python`
- Mark `backend` as Sources Root
- Add `PYTHONPATH` to run configurations 