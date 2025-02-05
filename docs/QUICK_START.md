# Quick Start Guide

## Prerequisites

- Python 3.11+
- Node.js 18+
- ffmpeg
- libmagic

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd mam-poc
```

2. Set up the Python environment:
```bash
# The environment manager will handle virtual environment setup
source scripts/env/venv_manager.sh

# Activate environment (clean activation)
av!

# Verify environment
venv-status
```

3. Install dependencies:
```bash
# Backend dependencies
cd backend
pip install -r requirements.txt

# Frontend dependencies
cd ../frontend
npm install
```

## Development

1. Start all services:
```bash
./launch_mam.command
```

This will:
- Start the Flask backend (port 5001)
- Start the React development server (port 3001)
- Launch the Electron application

2. Access the application:
- Backend API: http://localhost:5001
- Frontend (browser): http://localhost:3001
- Electron app will launch automatically

## Service Management

Use the service management scripts:

```bash
# Start all services
./scripts/manage_services.sh start

# Stop all services
./scripts/manage_services.sh stop

# Restart all services
./scripts/manage_services.sh restart

# Clean temporary files
./scripts/manage_services.sh cleanup
```

## Environment Variables

### Backend (.env)
```
FLASK_APP=app
FLASK_ENV=development
MEDIA_BASE_PATH="/path/to/media"
```

### Frontend (.env)
```
PORT=3001
REACT_APP_API_PORT=5001
REACT_APP_API_HOST=localhost
REACT_APP_WS_URL=ws://localhost:5001/ws
```

## Project Structure

```
mam-poc/
├── backend/           # Flask backend
│   ├── .venv/        # Python virtual environment (main)
│   ├── app/          # Application code
│   ├── tests/        # Backend tests
│   └── requirements.txt
├── frontend/         # React/Electron frontend
│   ├── src/         # Source code
│   ├── public/      # Static files
│   └── package.json
├── docs/            # Documentation
├── scripts/         # Management scripts
└── .venv -> backend/.venv  # Symbolic link to virtual environment
```

## Common Issues

1. Port conflicts:
```bash
# Check if ports are in use
lsof -i :5001,3001

# Kill processes if needed
./scripts/manage_services.sh stop
```

2. Virtual environment issues:
```bash
# Clean activation with environment manager
av!

# Check environment status
venv-status

# View environment logs
venv-log
```

3. WebSocket connection issues:
```bash
# Check WebSocket endpoint
curl http://localhost:5001/api/v1/health/status

# Check WebSocket stats
curl http://localhost:5001/api/v1/websocket/stats
```

## Next Steps

- Read the [Architecture Documentation](./architecture/README.md)
- Check the [API Documentation](./api/README.md)
- Review [Deployment Guide](./deployment/README.md)

<!-- 
This guide provides essential information for developers to quickly get started
with the Media Asset Manager (MAM) system. It includes common commands,
configuration options, and troubleshooting tips.
-->

## 1. Development Setup

```bash
# Backend Setup
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
flask run --port=5001

# Frontend Setup
cd frontend
npm install
npm start  # Runs on port 3001
```

## 2. Environment Configuration

<!-- Key environment variables for local development -->

```env
# Backend (.env)
FLASK_APP=backend.app
FLASK_ENV=development
MEDIA_BASE_PATH="/path/to/media"
DATABASE_URL="sqlite:///path/to/db"

# Frontend (.env)
REACT_APP_API_URL=http://localhost:5001/api/v1
REACT_APP_WS_URL=ws://localhost:5001/ws  # Note: The WebSocket endpoint must match the backend configuration
```

## 3. Common Commands

<!-- Frequently used development commands -->

```bash
# Health Check
curl http://localhost:5001/api/v1/health/status

# Database Operations
flask db upgrade                  # Apply migrations
flask db migrate -m "message"     # Create migration

# Asset Management
curl -X POST http://localhost:5001/api/v1/assets/scan  # Scan for new media
```

## 4. Development Tools

<!-- Essential tools and extensions for development -->

- VSCode Extensions:
  - ESLint
  - Prettier
  - Python
  - SQLite Viewer
  - Mermaid Preview

- Browser Extensions:
  - React Developer Tools
  - WebSocket Test Client

## 5. Common Issues

<!-- Quick solutions for common development problems -->

1. **WebSocket Connection Failed**
   ```bash
   # Check if backend is running
   curl http://localhost:5001/health
   # Check WebSocket endpoint
   curl -N -H "Connection: Upgrade" \
        -H "Upgrade: websocket" \
        -H "Host: localhost:5001" \
        -H "Origin: http://localhost:3001" \
        "http://localhost:5001/ws"
   ```

2. **Database Issues**
   ```bash
   # Reset database
   rm data/mam.db
   flask db upgrade
   ```

3. **Frontend Build Errors**
   ```bash
   # Clear cache and node_modules
   rm -rf node_modules
   npm cache clean --force
   npm install
   ```

## 6. API Endpoints

<!-- Quick reference for common API endpoints -->

```http
# Assets
GET    /api/v1/assets           # List assets
POST   /api/v1/assets/scan      # Scan for new assets
GET    /api/v1/assets/{id}      # Get asset details

# System
GET    /api/v1/health/status    # System health
GET    /api/v1/config           # Current configuration
```

## 7. WebSocket Events

<!-- Common WebSocket events and their handlers -->

```javascript
// Connection
ws.onopen = () => console.log('Connected');
ws.onclose = () => console.log('Disconnected');

// Message Types
{
    type: 'scan_progress',
    data: { current: 10, total: 100 }
}
{
    type: 'scan_complete',
    data: { added: 5, updated: 2 }
}
```

## 8. Monitoring

<!-- Development monitoring tools -->

```bash
# Memory Usage
./scripts/monitor_memory.sh

# Disk Space
./scripts/check_disk_space.sh

# Logs
tail -f logs/app.log
```

<!-- 
Note: This is a living document. Please update as needed.
Last updated: 2025-02-03
--> 