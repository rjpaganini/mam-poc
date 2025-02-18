# API Documentation

Version: 1.0.2
Last Updated: February 13, 2025

## Base URL
```
http://localhost:5001/api/v1
```

## Authentication
Currently using development mode without authentication.

## Health Check

### GET /health/status
Check system health status.

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-02-13T05:45:05.409004",
  "components": {
    "database": {
      "status": "connected",
      "message": "SQLite connection established"
    },
    "websocket": {
      "status": "connected",
      "connections": 1
    },
    "media_path": {
      "status": "accessible",
      "path": "/path/to/media"
    }
  }
}
```

## Media Assets

### GET /assets
List media assets with pagination.

Parameters:
- page (optional): Page number (default: 1)
- per_page (optional): Items per page (default: 20)
- sort (optional): Sort field (default: "updated_at")
- order (optional): Sort order ("asc" or "desc", default: "desc")
- search (optional): Search term
- format (optional): Filter by format (e.g. "mp4", "mov")

Response:
```json
{
  "items": [
    {
      "id": 1,
      "title": "Sample Video",
      "file_path": "/path/to/video.mp4",
      "file_size": 1048576,
      "file_size_mb": 1.0,
      "format": "mp4",
      "duration": 120.5,
      "duration_formatted": "00:02:00",
      "width": 1920,
      "height": 1080,
      "fps": 29.97,
      "codec": "h264",
      "container_format": "mp4",
      "bit_rate": 2000000,
      "created_at": "2025-02-13T05:45:05.409004",
      "updated_at": "2025-02-13T05:45:05.409004"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total_items": 100,
    "total_pages": 5
  }
}
```

### GET /assets/{id}
Get single asset details.

Response:
```json
{
  "id": 1,
  "title": "Sample Video",
  "file_path": "/path/to/video.mp4",
  "file_size": 1048576,
  "file_size_mb": 1.0,
  "format": "mp4",
  "duration": 120.5,
  "duration_formatted": "00:02:00",
  "width": 1920,
  "height": 1080,
  "fps": 29.97,
  "codec": "h264",
  "container_format": "mp4",
  "bit_rate": 2000000,
  "created_at": "2025-02-13T05:45:05.409004",
  "updated_at": "2025-02-13T05:45:05.409004"
}
```

### GET /assets/{id}/thumbnail
Get asset thumbnail.

Response:
- Content-Type: image/jpeg
- Binary image data

### GET /assets/{id}/stream
Stream media asset. All media access is routed through the API for security.

Response:
- Content-Type: video/mp4 (or appropriate mime type)
- Chunked video stream

## WebSocket Events

Connect to WebSocket:
```javascript
import io from 'socket.io-client';

const socket = io('ws://localhost:5001', {
  path: '/socket.io',
  transports: ['websocket']
});
```

### Events

#### asset.updated
Emitted when an asset is updated.
```json
{
  "type": "asset.updated",
  "data": {
    "id": 1,
    "title": "Updated Title",
    "updated_at": "2025-02-13T05:45:05.409004"
  }
}
```

#### asset.deleted
Emitted when an asset is deleted.
```json
{
  "type": "asset.deleted",
  "data": {
    "id": 1
  }
}
```

## Error Responses

All errors follow this format:
```json
{
  "error": {
    "code": "ASSET_NOT_FOUND",
    "message": "Asset with ID 1 not found",
    "path": "/api/v1/assets/1",
    "timestamp": "2025-02-13T05:45:05.409004"
  }
}
```

Common error codes:
- ASSET_NOT_FOUND
- INVALID_REQUEST
- DATABASE_ERROR
- MEDIA_ACCESS_ERROR
- THUMBNAIL_ERROR
- INTERNAL_ERROR

## Rate Limiting
- 100 requests per minute per IP
- Applies to all endpoints except streaming
- Headers:
  - X-RateLimit-Limit
  - X-RateLimit-Remaining
  - X-RateLimit-Reset 