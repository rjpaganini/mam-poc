# Troubleshooting Guide

Version: 1.0.2
Last Updated: February 13, 2025

## Quick Reference

```bash
# Check service status
./scripts/mam status

# View service logs
./scripts/mam logs

# Check system health
./scripts/mam health

# Verify environment
./scripts/mam env check
```

## Common Issues

### 1. Application Won't Start

#### Service Issues
```
Error: Service failed to start
```
**Solution:**
1. Check service status:
```bash
./scripts/mam status
```
2. View service logs:
```bash
./scripts/mam logs
```
3. Restart services:
```bash
./scripts/mam restart
```

#### Individual Service Issues
```
Error: Specific service not responding
```
**Solution:**
1. Check specific service:
```bash
./scripts/mam logs backend   # For backend issues
./scripts/mam logs frontend  # For frontend issues
```
2. Restart specific service:
```bash
./scripts/mam restart backend
./scripts/mam restart frontend
```

### 2. Media Files Not Loading

#### File Path Issues
```
Error: Media file not found
```
**Solution:**
1. Verify media files:
```bash
./scripts/mam maint verify
```
2. Check logs for details:
```bash
./scripts/mam logs backend
```

#### Streaming Issues
```
Error: Failed to load video
```
**Solution:**
1. Check service health:
```bash
./scripts/mam health
```
2. Verify media files:
```bash
./scripts/mam maint verify
```
3. View detailed logs:
```bash
./scripts/mam logs
```

### 3. Thumbnail Generation Fails

#### Generation Issues
```
Error: Thumbnail generation failed
```
**Solution:**
1. Regenerate thumbnails:
```bash
./scripts/mam maint thumbnails
```
2. Check logs for errors:
```bash
./scripts/mam logs backend
```

#### Storage Issues
```
Error: No space left on device
```
**Solution:**
1. Clean temporary files:
```bash
./scripts/mam maint cleanup
```
2. Check system health:
```bash
./scripts/mam health
```

### 4. Database Issues

#### Connection Errors
```
Error: Database is locked
```
**Solution:**
1. Check database status:
```bash
./scripts/mam db verify
```
2. Create backup:
```bash
./scripts/mam db backup
```
3. Reinitialize if needed:
```bash
./scripts/mam db init
```

#### Corruption Issues
```
Error: Database is corrupted
```
**Solution:**
1. Stop services:
```bash
./scripts/mam stop
```
2. Verify database:
```bash
./scripts/mam db verify
```
3. Restore from backup:
```bash
./scripts/mam db merge <backup_path>
```

### 5. Environment Issues

#### Python Environment
```
Error: Python environment issues
```
**Solution:**
1. Check environment:
```bash
./scripts/mam env check
```
2. View environment logs:
```bash
./scripts/mam logs
```

#### Node/Electron Issues
```
Error: Frontend build fails
```
**Solution:**
1. Check environment:
```bash
./scripts/mam env check
```
2. Restart frontend:
```bash
./scripts/mam restart frontend
```

### 6. Performance Issues

#### Slow Loading
```
Error: Request timeout
```
**Solution:**
1. Check service health:
```bash
./scripts/mam health
```
2. View performance logs:
```bash
./scripts/mam logs
```
3. Restart services:
```bash
./scripts/mam restart
```

#### Memory Issues
```
Error: Out of memory
```
**Solution:**
1. Stop services:
```bash
./scripts/mam stop
```
2. Clean temporary files:
```bash
./scripts/mam maint cleanup
```
3. Restart services:
```bash
./scripts/mam start
```

### 7. Maintenance

#### Regular Maintenance
```bash
# Full maintenance
./scripts/mam maint all

# Individual tasks
./scripts/mam maint thumbnails  # Regenerate thumbnails
./scripts/mam maint durations   # Check media durations
./scripts/mam maint cleanup     # Clean temporary files
./scripts/mam maint verify      # Verify media files
```

#### Health Checks
```bash
# Full health check
./scripts/mam health

# Service status
./scripts/mam status

# Environment check
./scripts/mam env check
```

#### Log Management
```bash
# View all logs
./scripts/mam logs

# View specific logs
./scripts/mam logs backend
./scripts/mam logs frontend
```

## Diagnostic Commands

### System Status
```bash
# Check all services
./scripts/health_check.sh

# View logs
tail -f logs/*.log

# Check ports
lsof -i :5001
lsof -i :3001
```

### Database
```bash
# Check integrity
sqlite3 data/merged.db "PRAGMA integrity_check;"

# Backup database
./scripts/backup_db.sh

# View recent entries
sqlite3 data/merged.db "SELECT * FROM media_assets ORDER BY updated_at DESC LIMIT 5;"
```

### File System
```bash
# Check permissions
ls -l data/
ls -l media/

# View disk usage
du -sh data/
du -sh media/

# Find large files
find . -type f -size +100M
```

### Process Management
```bash
# View processes
ps aux | grep mam-poc

# Kill processes
pkill -f mam-poc

# Monitor resources
top -pid $(pgrep -f mam-poc)
``` 