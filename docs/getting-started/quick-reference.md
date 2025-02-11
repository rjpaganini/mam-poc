# Quick Reference Guide

Version: 1.0.1
Last Updated: February 10, 2025

## Common Commands

### Service Management
```bash
# Start all services
./scripts/launch.sh start

# Stop all services
./scripts/launch.sh stop

# Check service status
./scripts/launch.sh status

# View logs
./scripts/launch.sh logs
```

### Health Checks
```bash
# Check backend health
curl http://localhost:5001/api/v1/health/status

# Check WebSocket connection
curl http://localhost:5001/api/v1/health/websocket
```

### Development Tools
```bash
# Run backend tests
python -m pytest

# Run frontend tests
cd frontend && npm test

# Check TypeScript types
cd frontend && npm run typecheck

# Lint frontend code
cd frontend && npm run lint
```

## Quick Troubleshooting

### 1. Service Issues
```bash
# Check if ports are in use
lsof -i :5001  # Backend API
lsof -i :3001  # Frontend Dev Server

# Clear ports if needed
./scripts/launch.sh stop
```

### 2. Database Issues
```bash
# Check PostgreSQL status
pg_isready

# Reset database (if needed)
./scripts/launch.sh reset-db
```

### 3. WebSocket Connection
```bash
# Verify backend is running
curl http://localhost:5001/api/v1/health/status

# Check WebSocket endpoint
curl http://localhost:5001/api/v1/health/websocket
```

### 4. Media Processing
```bash
# Check FFmpeg installation
ffmpeg -version

# Verify media directory permissions
ls -l $MEDIA_ROOT

# Monitor processing logs
tail -f logs/backend.log | grep "processing"
```

## Frequently Used Endpoints

### Core API
- `GET /api/v1/health/status` - System health
- `GET /api/v1/assets` - List all assets
- `GET /api/v1/assets/:id` - Get single asset
- `GET /api/v1/media/asset/:id` - Stream media file

### WebSocket Events
- `status_update` - Processing status updates
- `error` - Error notifications

## Development Tools

### Required VSCode Extensions
- ESLint
- Prettier
- Python
- TypeScript and JavaScript
- SQLite Viewer

### Browser Extensions
- React Developer Tools
- Redux DevTools

## Quick Links
- [Main Documentation](../../README.md)
- [API Reference](../api/README.md)
- [Troubleshooting Guide](../TROUBLESHOOTING.md) 