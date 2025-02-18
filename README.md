# Media Asset Manager (MAM)

Version: 1.0.2
Last Updated: February 13, 2025

Simple media asset management system with real-time updates and AWS integration.

## Quick Start

1. Configure Environment
```bash
# Setup Python environment
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Setup frontend
cd ../frontend
npm install
```

2. Start Services
```bash
# Start all services (recommended)
./scripts/mam start

# Check health status
./scripts/mam health
```

## Key Features
- 📁 Media file management
- 🔄 Real-time updates via WebSocket
- 🖼️ Automatic thumbnail generation
- 🔍 Search and filtering
- 📊 Basic media processing
- ☁️ AWS integration for advanced processing

## System Requirements
- Python 3.12+ (Tested with 3.12.1)
- Node.js 18+ (Tested with 18.19.0)
- FFmpeg (Tested with 6.1)
- SQLite 3.x

## Development Setup

1. Configure Environment
```bash
cp backend/.env.example backend/.env
# Edit .env with your settings
```

2. Service Management
```bash
# Start all services
./scripts/mam start

# Start specific service
./scripts/mam start backend
./scripts/mam start frontend
./scripts/mam start electron

# Stop services
./scripts/mam stop

# Restart services
./scripts/mam restart

# Check status
./scripts/mam status
```

## Project Structure
```
mam-poc/
├── backend/          # Flask backend
├── frontend/         # React frontend (Electron)
├── scripts/         # Utility scripts
│   ├── core/       # Core management scripts
│   ├── db/         # Database utilities
│   └── maint/      # Maintenance tools
└── docs/           # Detailed documentation
```

## Common Commands
```bash
# Health check
./scripts/mam health

# View logs
./scripts/mam logs
./scripts/mam logs backend  # View specific service logs
./scripts/mam logs frontend

# Database operations
./scripts/mam db init      # Initialize database
./scripts/mam db verify    # Verify integrity
./scripts/mam db backup    # Create backup

# Maintenance
./scripts/mam maint thumbnails  # Regenerate thumbnails
./scripts/mam maint cleanup     # Clean temporary files
./scripts/mam maint verify      # Verify media files

# Environment
./scripts/mam env check    # Verify environment
```

## Documentation
- [API Documentation](docs/API.md) - API endpoints and WebSocket protocol
- [Development Guide](docs/DEVELOPMENT.md) - Setup and best practices
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions

## Service Ports
- Backend API & WebSocket: 5001
- Frontend Dev Server: 3001

## Quick Troubleshooting
- Port conflicts: Use `./scripts/mam status` to check service status
- Media not loading: Verify paths in `.env`
- WebSocket issues: Check logs with `./scripts/mam logs backend`
- Electron issues: Use `./scripts/mam restart electron`

## Version History
See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

## License
Copyright © 2024 Valen Media. All rights reserved.

## Database Configuration

This application uses a single SQLite database as the source of truth for all metadata:

- **Location**: `data/merged.db`
- **Purpose**: Stores all media asset metadata, tags, and processing results
- **Schema**: Enhanced schema supporting rich metadata, tags, and AI processing results

The database path is configured in `backend/app/config.py` and should not be changed unless you're performing a database migration. All services use this centralized configuration to ensure consistency.

> **Important**: Do not create additional databases or modify the database path. The application expects a single source of truth for all metadata.
