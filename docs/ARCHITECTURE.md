# MAM Technical Architecture

## Core Components

### 1. Media Asset Management
```
/api/v1/assets
├── GET /                 # List assets with pagination and filters
├── POST /               # Add new asset
├── GET /<id>           # Get single asset
└── DELETE /<id>        # Delete asset
```

**Critical Path Information:**
- Media files are LOCAL files only, despite Google Drive path in config
- Thumbnail generation happens asynchronously
- File paths must be validated against allowed directories
- All paths are stored relative to MEDIA_BASE_PATH

**Common Pitfalls:**
- Thumbnail URLs stored in media_metadata must not include API_PREFIX
- Google Drive path is just a local directory, no cloud integration
- File paths must use forward slashes, even on Windows
- Always validate file existence before operations

### 2. WebSocket System

**Connection Flow:**
```
Client                              Server
   │                                  │
   ├─── Initial Connection ──────────>│
   │                                  │
   │<─── Connection Accepted ─────────┤
   │                                  │
   ├─── {"type": "ping"} ──────────>│ Every 25s
   │                                  │
   │<─── Processing Updates ──────────┤
```

**Key Points:**
- WebSocket runs on same port as API (5001)
- Heartbeat required every 25 seconds
- Reconnection handled by client with exponential backoff
- All messages must be valid JSON

**Message Types:**
```typescript
interface WebSocketMessage {
    type: 'processing_update' | 'ping' | 'connection';
    data?: {
        asset_id?: number;
        progress?: number;
        stage?: string;
        status?: string;
    };
}
```

### 3. File System Structure

```
mam-poc/
├── backend/
│   ├── app/
│   │   ├── routes/          # API endpoints
│   │   ├── utils/           # Utility functions
│   │   ├── ai/             # Processing logic
│   │   └── config.py       # Central config
│   └── data/
│       ├── thumbnails/     # Generated thumbnails
│       └── mam.db         # SQLite database
└── frontend/
    └── src/
        ├── services/       # API/WebSocket clients
        └── components/     # React components
```

**Path Handling:**
- All paths in config.py are absolute
- All paths in code are relative to MEDIA_BASE_PATH
- Thumbnail paths are relative to DATA_DIR/thumbnails
- Database file is in DATA_DIR/mam.db

### 4. API Response Structure

**Asset Response:**
```typescript
interface Asset {
    id: number;
    title: string;
    file_path: string;
    mime_type: string;
    file_size: number;
    created_at: string;
    updated_at: string;
    media_metadata: {
        width?: number;
        height?: number;
        duration?: number;
        thumbnail_url?: string;  // Relative path: /thumbnails/xyz.jpg
        codec?: string;
        fps?: number;
    };
}
```

**List Response:**
```typescript
interface ListResponse {
    items: Asset[];
    meta: {
        page: number;
        total: number;
        pages: number;
    };
}
```

### 5. Error Handling

**HTTP Status Codes:**
- 400: Invalid request (bad file path, unsupported type)
- 404: Asset/thumbnail not found
- 500: Processing/server errors
- 503: Service unavailable (health check failed)

**Error Response:**
```typescript
interface ErrorResponse {
    error: string;
    timestamp: string;
    context?: {
        file_path?: string;
        asset_id?: number;
        stage?: string;
    };
}
```

### 6. Media Processing

**Supported Types:**
```python
MEDIA_TYPES = {
    'video': {'.mp4', '.mov', '.avi'},
    'image': {'.jpg', '.png', '.gif'}
}
```

**Processing Flow:**
1. File added via API
2. Metadata extracted
3. Thumbnail generated asynchronously
4. WebSocket updates sent to clients
5. Database updated with metadata

**Watch Out For:**
- Large files can timeout during upload
- Thumbnail generation can fail silently
- Processing updates may be lost during reconnection
- File permissions must allow read/write

### 7. Configuration Management

**Critical Settings:**
```python
Config.MEDIA_BASE_PATH    # Base path for all media files
Config.DATA_DIR          # Location for thumbnails and DB
Config.THUMBNAIL_DIR     # Must be under DATA_DIR
Config.API_PREFIX       # Default: /api/v1
```

**Environment Variables:**
```bash
FLASK_DEBUG=1           # Enable debug mode
FLASK_ENV=development   # Environment type
DATA_DIR=./data        # Data directory location
MEDIA_PATH=./media     # Media files location
```

### 8. Health Monitoring

**Health Check Endpoints:**
```
/api/v1/health/status      # Overall system health
/api/v1/health/websocket   # WebSocket status
/api/v1/health/processing  # Processing queue status
```

**Monitored Components:**
- Database connectivity
- WebSocket connections
- Memory usage
- Processing queue
- File system access

### 9. Security Considerations

**File Access:**
- Validate all file paths
- Check for directory traversal
- Verify file permissions
- Sanitize file names

**API Security:**
- CORS configured for frontend only
- WebSocket validates origin
- File paths are never exposed to client
- Thumbnail access is rate-limited

### 10. Development Guidelines

**Best Practices:**
- Always use Config class for settings
- Handle WebSocket reconnection gracefully
- Log all file operations
- Validate paths before operations
- Use type hints everywhere
- Handle component dependencies properly

**Common Issues:**
1. Thumbnail generation fails
   - Check file permissions
   - Verify THUMBNAIL_DIR exists
   - Check disk space
   - Look for ffmpeg errors

2. WebSocket disconnects
   - Check heartbeat timing
   - Verify no proxy interference
   - Look for connection timeouts
   - Check client reconnection logic

3. File access errors
   - Verify paths are absolute
   - Check file permissions
   - Validate file exists
   - Handle path separators

4. Processing hangs
   - Check memory usage
   - Look for zombie processes
   - Verify queue status
   - Check disk space

## Quick Reference

### Start Services:
```bash
# Start backend
cd backend
source .venv/bin/activate
python wsgi.py

# Start frontend (new terminal)
cd frontend
npm start
```

### Verify Setup:
```bash
# Check health
curl http://localhost:5001/api/v1/health/status

# Check WebSocket
wscat -c ws://localhost:5001/ws

# Check file access
ls -l data/thumbnails
ls -l "configured media path"
```

### Monitor Logs:
```bash
tail -f logs/app.log       # Application logs
tail -f logs/error.log     # Error logs
tail -f logs/system.log    # System logs
``` 