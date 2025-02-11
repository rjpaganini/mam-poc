# API Documentation

Version: 1.0.1
Last Updated: February 10, 2025
API Version: v1

## Base URL
All endpoints are prefixed with `/api/v1`

## Core Endpoints

### Media Assets
- `GET /assets` - List all assets
- `GET /assets/:id` - Get single asset
- `GET /media/asset/:id` - Stream media file
- `GET /thumbnails/:id` - Get asset thumbnail

### System
- `GET /health/status` - System health check

## WebSocket Protocol

### Connection
```javascript
const socket = new WebSocket('ws://localhost:5001/ws');
```

### Message Types
1. Status Updates
```json
{
  "type": "status_update",
  "asset_id": 123,
  "progress": 45,
  "stage": "processing"
}
```

2. Error Messages
```json
{
  "type": "error",
  "message": "Processing failed",
  "details": { "reason": "Invalid format" }
}
```

## Common Response Formats

### Asset Object
```json
{
  "id": 1,
  "title": "example.mp4",
  "file_path": "/path/to/file.mp4",
  "file_size_mb": 256.5,
  "format": "mp4",
  "duration": 120.5,
  "width": 1920,
  "height": 1080,
  "codec": "h264",
  "created_at": "2024-03-21T10:00:00Z"
}
```

### Error Response
```json
{
  "error": "Asset not found",
  "status": 404,
  "timestamp": "2024-03-21T10:00:00Z"
}
```

## Quick Examples

### List Assets
```bash
curl http://localhost:5001/api/v1/assets
```

### Get Asset Details
```bash
curl http://localhost:5001/api/v1/assets/123
```

### Stream Media
```bash
curl http://localhost:5001/api/v1/media/asset/123
```

### Check Health
```bash
curl http://localhost:5001/api/v1/health/status
```

## Rate Limits
- API calls: 100/minute
- WebSocket messages: 60/minute
- Media streaming: 10 concurrent streams

## Error Codes
- 200: Success
- 400: Bad Request
- 404: Not Found
- 429: Too Many Requests
- 500: Server Error

## Security Notes
- All endpoints require valid authentication
- File paths are validated server-side
- WebSocket connections require handshake 