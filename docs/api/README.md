# API Documentation

## Base URL
All API endpoints are prefixed with `/api/v1`

## Authentication
Currently using basic authentication for development.

## Endpoints

### Assets

#### GET /api/v1/assets
List all media assets.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `sort`: Sort field (name, size, created_at)
- `order`: Sort order (asc, desc)

**Response:**
```json
{
  "items": [
    {
      "id": "string",
      "name": "string",
      "path": "string",
      "size": "number",
      "type": "string",
      "created_at": "string",
      "metadata": {
        "duration": "number",
        "resolution": "string",
        "fps": "number"
      }
    }
  ],
  "total": "number",
  "page": "number",
  "pages": "number"
}
```

#### GET /api/v1/assets/:id
Get single asset details.

**Response:** Single asset object

#### GET /api/v1/thumbnails/:id
Get asset thumbnail.

**Query Parameters:**
- `size`: Thumbnail size (small, medium, large)

**Response:** Image file

### System Operations

#### POST /api/v1/scan
Scan for new media files.

**Response:**
```json
{
  "status": "string",
  "files_found": "number",
  "files_processed": "number"
}
```

#### GET /api/v1/health
Get system health status.

**Response:**
```json
{
  "status": "string",
  "database": {
    "connected": "boolean",
    "active_sessions": "number"
  },
  "memory": {
    "usage_percent": "number",
    "rss": "number"
  }
}
```

#### GET /api/v1/health/status
Get comprehensive system health status.

**Response:**
```json
{
  "status": "string",
  "timestamp": "string",
  "database": {
    "connected": "boolean",
    "active_sessions": "number"
  },
  "disk": {
    "free_space": "number",
    "used_space": "number",
    "total_space": "number",
    "percent_used": "number"
  },
  "memory": {
    "usage_percent": "number",
    "rss": "number",
    "vms": "number",
    "system_percent": "number"
  },
  "websocket": {
    "active_connections": "number",
    "last_ping": "string"
  }
}
```

**Status Values:**
- `"HEALTHY"`: All systems operational
- `"DEGRADED"`: Some systems experiencing issues
- `"CRITICAL"`: Critical system issues detected

**Example Usage:**
```bash
curl http://localhost:5001/api/v1/health/status
```

## WebSocket Events

### Connection
```javascript
ws://localhost:5001/ws
```

### Events
- `thumbnail_progress`: Thumbnail generation progress
- `scan_progress`: Media scanning progress
- `system_status`: System status updates

## Error Handling

All errors follow this format:
```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": "object"
  }
}
```

Common error codes:
- `400`: Bad Request
- `404`: Not Found
- `500`: Internal Server Error
