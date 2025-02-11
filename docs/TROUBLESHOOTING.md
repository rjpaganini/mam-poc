# Troubleshooting Guide

Version: 1.0.1
Last Updated: February 10, 2025
Applies to: MAM v1.0.0 and later

## Quick Fixes

### Service Won't Start
1. Check ports in use:
```bash
lsof -i :5001
lsof -i :3000
```

2. Verify Python environment:
```bash
which python
python --version
```

3. Check Node version:
```bash
node --version
```

### Media Not Loading
1. Verify file permissions:
```bash
ls -l /path/to/media
```

2. Check FFmpeg installation:
```bash
ffmpeg -version
```

3. Verify media paths in `.env`:
```bash
MEDIA_ROOT=/path/to/media
```

### WebSocket Issues
1. Check WebSocket logs:
```bash
tail -f logs/backend.log
```

2. Verify connection URL:
```javascript
ws://localhost:5001/ws
```

3. Monitor connection status in browser console

## Common Error Messages

### Backend Errors

#### "Port already in use"
```bash
# Kill existing process
lsof -i :5001 | grep LISTEN
kill -9 <PID>
```

#### "FFmpeg not found"
```bash
# Install FFmpeg
brew install ffmpeg  # macOS
apt-get install ffmpeg  # Ubuntu
```

#### "Database connection failed"
1. Check PostgreSQL service:
```bash
pg_isready
```

2. Verify database URL:
```bash
# .env file
DATABASE_URL=postgresql://user:pass@localhost/mam
```

### Frontend Errors

#### "Failed to compile"
1. Clear node_modules:
```bash
rm -rf node_modules
npm install
```

2. Check for TypeScript errors:
```bash
npm run typecheck
```

#### "WebSocket connection failed"
1. Verify backend is running
2. Check CORS settings
3. Verify WebSocket URL

## System Health

### Check Services
```bash
# Backend health
curl http://localhost:5001/api/v1/health/status

# Database connection
python scripts/check_db.py

# Media storage
python scripts/check_storage.py
```

### View Logs
```bash
# Backend logs
tail -f logs/backend.log

# Frontend logs
tail -f logs/frontend.log

# All logs
tail -f logs/*.log
```

### Monitor Resources
```bash
# Disk space
df -h

# Memory usage
top -o mem

# Process status
ps aux | grep python
ps aux | grep node
```

## Recovery Steps

### Database Reset
```bash
# Backup current data
pg_dump mam > backup.sql

# Reset database
python scripts/reset_db.py

# Restore from backup
psql mam < backup.sql
```

### Clear Cache
```bash
# Clear thumbnails
rm -rf cache/thumbnails/*

# Clear media cache
rm -rf cache/media/*

# Clear temporary files
rm -rf tmp/*
```

### Reset Application
1. Stop all services
2. Clear all caches
3. Reset database
4. Restart services

## Getting Help
1. Check logs first
2. Review configuration
3. Test system health
4. Contact support with:
   - Log files
   - Error messages
   - Steps to reproduce 