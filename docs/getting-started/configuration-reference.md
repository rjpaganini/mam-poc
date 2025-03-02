# Configuration Reference

Version: 1.0.2
Last Updated: February 13, 2025

## Environment Variables

### Backend (.env)
```bash
# Core Settings
API_HOST=127.0.0.1
API_PORT=5001

# Media Configuration
MEDIA_ROOT=/path/to/media/storage
CLOUD_STORAGE_ENABLED=true
CLOUD_STORAGE_PATH=/path/to/google/drive

# WebSocket
SOCKET_CORS_ORIGINS=http://localhost:3001

# Development
FLASK_DEBUG=1
FLASK_ENV=development

# Memory Management
THUMBNAIL_CACHE_SIZE=1024  # MB
MEDIA_CACHE_SIZE=5120      # MB

# Database
SQLITE_DB_PATH=data/merged.db
```

### Frontend (.env)
```bash
# Development Server
PORT=3001
ELECTRON_START_URL=http://localhost:3001

# API Configuration
REACT_APP_API_URL=http://localhost:5001/api/v1
REACT_APP_WS_URL=ws://localhost:5001/ws

# Electron Configuration
ELECTRON_PROTOCOL=video
```

## Directory Structure
```
mam-poc/
├── backend/           # Flask backend
│   ├── app/          # Application code
│   │   ├── routes/   # API endpoints
│   │   ├── models.py # Database models
│   │   └── main.py   # Entry point
│   ├── tests/        # Backend tests
│   └── requirements.txt
├── frontend/         # React frontend
│   ├── src/         # Source code
│   ├── public/      # Static files
│   ├── macos/       # Electron main process
│   └── package.json
├── scripts/         # Utility scripts
│   ├── core/       # Core management scripts
│   ├── db/         # Database utilities
│   └── maint/      # Maintenance tools
├── docs/           # Documentation
├── logs/           # Application logs
└── data/           # Application data
    ├── media/      # Media storage
    └── thumbnails/ # Generated thumbnails
```

## Configuration Best Practices

### Development Environment
1. Enable debug mode for detailed logs
2. Use local SQLite database
3. Set reasonable cache sizes
4. Enable CORS for development URLs

### Production Environment
1. Disable debug mode
2. Use production-ready servers
3. Configure proper cache sizes
4. Set up proper logging
5. Enable security features

### Media Storage
1. Use absolute paths for media storage
2. Ensure proper permissions
3. Configure backup locations
4. Set up Google Drive integration

### Security Notes
1. Never commit .env files
2. Use strong secret keys
3. Restrict file permissions
4. Configure CORS properly

## Quick Setup

### 1. Local Development
```bash
# Copy example configs
cp .env.example .env
cp frontend/.env.example frontend/.env

# Edit configurations
vim .env
vim frontend/.env

# Verify configuration
./scripts/mam env check
```

### 2. Media Storage Setup
```bash
# Create required directories
mkdir -p data/{media,thumbnails}
mkdir -p logs

# Set permissions
chmod -R 755 data
chmod -R 755 logs

# Verify paths
./scripts/mam maint verify
```

### 3. Google Drive Setup
1. Install Google Drive File Stream
2. Mount Google Drive
3. Update `CLOUD_STORAGE_PATH` in `.env`
4. Enable cloud storage in configuration
5. Verify media access with `./scripts/mam maint verify`

## Validation

### Check Configuration
```bash
# Verify environment
./scripts/mam env check

# Test media access
./scripts/mam maint verify

# Check database
./scripts/mam db verify
```

### Common Configuration Issues
1. Invalid media paths
2. Incorrect permissions
3. Port conflicts
4. WebSocket connection issues
5. Database access errors

## Need Help?
- Check logs with `./scripts/mam logs`
- Review [Troubleshooting Guide](../TROUBLESHOOTING.md)
- Verify against example configurations 