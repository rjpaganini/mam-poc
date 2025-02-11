# Media Asset Manager (MAM)

Version: 1.0.1
Last Updated: February 10, 2025

Simple media asset management system with real-time updates.

## Quick Start

```bash
# Backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
npm install
npm start
```

## Key Features
- 📁 Media file management
- 🔄 Real-time updates via WebSocket
- 🖼️ Automatic thumbnail generation
- 🔍 Search and filtering
- 📊 Basic media processing

## System Requirements
- Python 3.12+ (Tested with 3.12.1)
- Node.js 18+ (Tested with 18.19.0)
- FFmpeg (Tested with 6.1)
- PostgreSQL 14+ (Tested with 14.10)

## Development Setup

1. Configure Environment
```bash
cp .env.example .env
# Edit .env with your settings
```

2. Start Services
```bash
# Start backend (localhost:5001)
python run.py

# Start frontend (localhost:3000)
npm start
```

## Project Structure
```
mam-poc/
├── backend/          # Flask backend
├── frontend/         # React frontend
├── scripts/         # Utility scripts
└── docs/           # Detailed documentation
```

## Common Commands
```bash
# Start all services
./scripts/launch.sh start

# Check system health
curl http://localhost:5001/api/v1/health/status

# View logs
tail -f logs/*.log
```

## Documentation
- [API Documentation](docs/API.md) - API endpoints and WebSocket protocol
- [Development Guide](docs/DEVELOPMENT.md) - Setup and best practices
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions

## Ports
- Backend API: 5001
- Frontend: 3000
- WebSocket: 5001/ws

## Quick Troubleshooting
- Port conflicts: Check `lsof -i :5001`
- Media not loading: Verify paths in `.env`
- WebSocket issues: Check `logs/backend.log`

## Version History
See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

## License
Copyright © 2025 Valen Media. All rights reserved.
