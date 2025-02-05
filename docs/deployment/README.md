# Deployment Guide

## Prerequisites

- Python 3.11+
- Node.js 18+
- FFmpeg
- PostgreSQL (optional, SQLite for development)
- Google Drive (optional, for cloud storage)

## Environment Setup

1. Python Virtual Environment
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. Node.js Dependencies
```bash
cd frontend
npm install
npm run build
```

## Configuration

1. Environment Variables
```bash
cp .env.example .env
```

Required variables:
- `MEDIA_BASE_PATH`: Absolute path to media directory
  - Local: `/path/to/media`
  - Google Drive: `/Users/<user>/Library/CloudStorage/GoogleDrive-<email>/My Drive/path/to/media`
- `DATABASE_URL`: Database connection string
- `SECRET_KEY`: Application secret key

Optional variables:
- `LOG_LEVEL`: Logging level (default: INFO)
- `CORS_ORIGINS`: Allowed CORS origins
- `MAX_UPLOAD_SIZE`: Maximum upload size in bytes
- `USE_CLOUD_STORAGE`: Enable cloud storage features (default: false)

## Storage Configuration

### Local Storage
Standard filesystem access, suitable for development and simple deployments:
```bash
MEDIA_BASE_PATH=/path/to/local/media
USE_CLOUD_STORAGE=false
```

### Google Drive Integration
For cloud-based storage using Google Drive:
```bash
MEDIA_BASE_PATH=/Users/<user>/Library/CloudStorage/GoogleDrive-<email>/My Drive/path/to/media
USE_CLOUD_STORAGE=true
```

Notes:
- Ensure Google Drive is mounted locally
- Configure proper file permissions
- Consider sync delays in your workflow
- Monitor available space

## Production Deployment

### Option 1: Docker (Recommended)

1. Build Images
```bash
docker-compose build
```

2. Run Services
```bash
docker-compose up -d
```

### Option 2: Manual Deployment

1. Backend (Gunicorn)
```bash
cd backend
gunicorn -w 4 -b 0.0.0.0:5001 'app:create_app()'
echo $! > backend.pid  # Save PID when starting service
kill $(cat backend.pid) # Clean shutdown
```

2. Frontend (Nginx)
```bash
cd frontend
npm run build
# Copy build to nginx serving directory
cp -r build/* /var/www/html/
```

## Monitoring

1. Health Checks
- `/api/v1/health/status` for comprehensive system status
- Real-time WebSocket monitoring
- Disk usage tracking with thresholds
- Memory usage monitoring
- Database connection status

2. Logging
- Application logs in `logs/app.log`
- Nginx access logs
- System metrics via Prometheus (optional)
- WebSocket connection logs
- Error tracking and reporting

3. Automatic Maintenance
```bash
# Clean temporary files
./scripts/manage_app.sh cleanup

# Clean development caches
npm cache clean --force
pip cache purge

# Monitor system health
./scripts/manage_app.sh health
```

4. Storage Management
- Automatic cleanup of temporary files
- Log rotation
- Thumbnail cache management
- Configurable cleanup thresholds

## Backup Strategy

1. Database
- Daily automated backups
- Keep last 7 daily backups
- Monthly archives

2. Media Files
- Regular filesystem backups
- Thumbnail regeneration capability

## Security Considerations

1. Network
- Use HTTPS in production
- Configure proper CORS settings
- Set up rate limiting

2. File Access
- Validate file paths
- Implement proper file permissions
- Sanitize user inputs

## Scaling Considerations

1. Horizontal Scaling
- Backend is stateless
- Use load balancer
- Consider CDN for media delivery

2. Database
- Connection pooling
- Query optimization
- Index management

## Troubleshooting

Common issues and solutions:
1. Permission Issues
   - Check file ownership
   - Verify process permissions
   - Review log files
   - For Google Drive: Check mount status

2. Performance Issues
   - Monitor resource usage
   - Check database queries
   - Analyze network traffic
   - For Google Drive: Monitor sync status

3. Media Access Issues
   - Verify media path exists
   - Check file permissions
   - For Google Drive: Ensure files are downloaded
   - Monitor Google Drive quota

4. CORS Issues
   - Check allowed origins in config
   - Verify media path is accessible
   - Review browser console errors
   - Check OPTIONS request responses

# Media Asset Manager (MAM) Deployment Guide

## System Health Monitoring

The MAM system includes a focused storage monitoring system that helps prevent disk space issues:

### Storage Status Widget
- Located at bottom-left corner of the interface
- Shows real-time disk usage with visual indicators
- Color-coded status:
  - Green: Normal usage (< 80%)
  - Yellow: Warning level (80-90%)
  - Red: Critical level (> 90%)

### Automatic Storage Management
The system includes automatic cleanup features:
- Log rotation: Automatically manages log file sizes
- Temporary file cleanup: Removes files older than 7 days
- npm cache cleanup: Triggered when disk usage is high

### Best Practices
1. Monitor the storage status widget regularly
2. Act on warning indicators promptly
3. Use the cleanup command when disk usage exceeds 80%:
   ```bash
   ./scripts/manage_services.sh cleanup
   ```

### Troubleshooting
If disk usage remains high after cleanup:
1. Check the `/logs` directory for large log files
2. Review the media storage directory for unused assets
3. Consider implementing the reference-based architecture for larger deployments

## Health Check API
The system exposes a health check endpoint at `/api/v1/health/status` that returns:
- Current disk usage percentage
- Available free space
- Total disk space

For more detailed system metrics or configuration options, refer to the full documentation.

# Clean up development files
./scripts/manage_services.sh cleanup

# Clean up development tools
npm cache clean --force  # Clean npm cache
pip cache purge         # Clean pip cache

# Current state:
- 8 vulnerabilities (2 moderate, 6 high)
- All in development dependencies
- No production impact

## Data Handling Considerations

### File Size Handling
- Backend stores file sizes in bytes (BigInteger)
- Frontend displays sizes in megabytes (MB)
- Formatter handles both byte and MB inputs intelligently:
  - Values < 1000 treated as MB
  - Larger values converted from bytes
  - Always displays with one decimal place

### WebSocket Stability
- Enhanced connection management with ping/pong
- Automatic reconnection on failure
- Connection status monitoring
- Proper cleanup on component unmount
