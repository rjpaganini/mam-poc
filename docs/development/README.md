# Development Guidelines

## Code Style and Standards

### Python (Backend)
- Follow PEP 8 style guide
- Use type hints for function parameters and returns
- Document functions and classes with docstrings
- Maximum line length: 100 characters
- Use f-strings for string formatting

Example:
```python
def process_media_file(
    file_path: str,
    options: dict[str, Any]
) -> tuple[bool, str]:
    """Process a media file with the given options.

    Args:
        file_path: Path to the media file
        options: Processing options

    Returns:
        Tuple of (success, message)
    """
    try:
        # Processing logic
        return True, "Success"
    except Exception as e:
        return False, str(e)
```

### TypeScript/JavaScript (Frontend)
- Use TypeScript for all new code
- Follow Airbnb JavaScript Style Guide
- Use ESLint and Prettier for code formatting
- Maximum line length: 100 characters
- Use async/await over Promises

Example:
```typescript
interface MediaAsset {
  id: number;
  title: string;
  file_path: string;
  file_size: number;
}

async function fetchAsset(id: number): Promise<MediaAsset> {
  try {
    const response = await fetch(`/api/v1/assets/${id}`);
    if (!response.ok) {
      throw new Error('Asset not found');
    }
    return response.json();
  } catch (error) {
    console.error('Failed to fetch asset:', error);
    throw error;
  }
}
```

## Project Structure

### Backend Structure
```
backend/
├── app/
│   ├── api/           # API endpoints
│   ├── core/          # Core functionality
│   ├── models/        # Database models
│   ├── services/      # Business logic
│   ├── utils/         # Utility functions
│   └── websocket/     # WebSocket handlers
├── tests/             # Test files
└── scripts/           # Maintenance scripts
```

### Frontend Structure
```
frontend/
├── src/
│   ├── components/    # React components
│   ├── hooks/         # Custom hooks
│   ├── pages/         # Page components
│   ├── services/      # API/WebSocket services
│   ├── store/         # State management
│   ├── types/         # TypeScript types
│   └── utils/         # Utility functions
└── public/            # Static assets
```

## Development Workflow

### 1. Version Control
- Use feature branches for all changes
- Branch naming: `feature/description` or `fix/description`
- Keep commits focused and well-documented
- Rebase feature branches on main before merging

### 2. Testing
- Write tests for all new features
- Update tests when modifying existing code
- Run tests before committing:
  ```bash
  # Backend tests
  pytest

  # Frontend tests
  npm test
  ```

### 3. Code Review
- All changes require code review
- Use pull request templates
- Address all review comments
- Ensure CI passes before merging

### 4. Service Management
- Use `launch.sh` for all service operations:
  ```bash
  # Start all services
  ./scripts/launch.sh start

  # Restart services (with health checks)
  ./scripts/launch.sh restart

  # Stop services
  ./scripts/launch.sh stop

  # Check service health
  curl http://localhost:5001/api/v1/health/status
  ```

- Service Architecture:
  - Backend API & WebSocket: Port 5001
  - Frontend Dev Server: Port 3001
  - Health checks ensure all components are running
  - Automatic log rotation and management
  - Graceful shutdown handling

- Troubleshooting Services:
  ```bash
  # View service logs
  tail -f logs/backend.log
  tail -f logs/frontend.log

  # Check port usage
  lsof -i :5001
  lsof -i :3001

  # Force cleanup (if needed)
  ./scripts/launch.sh force-stop
  ```

## Best Practices

### WebSocket Communication
```typescript
// Good: Handle reconnection and message queuing
class WebSocketService {
  private reconnectAttempts = 0;
  private messageQueue: string[] = [];

  connect() {
    this.socket = new WebSocket(WS_URL);
    this.socket.onclose = () => this.handleReconnection();
    this.socket.onopen = () => this.processMessageQueue();
  }

  private handleReconnection() {
    if (this.reconnectAttempts < MAX_ATTEMPTS) {
      setTimeout(() => this.connect(), BACKOFF_TIME);
      this.reconnectAttempts++;
    }
  }
}
```

### Error Handling
```python
# Good: Structured error handling with logging
from app.utils.logging import logger

class MediaProcessingError(Exception):
    """Base class for media processing errors."""
    pass

def process_media(file_path: str) -> None:
    try:
        # Processing logic
        pass
    except FileNotFoundError as e:
        logger.error(f"Media file not found: {file_path}", exc_info=e)
        raise MediaProcessingError("Media file not found") from e
    except Exception as e:
        logger.error(f"Failed to process media: {file_path}", exc_info=e)
        raise MediaProcessingError("Media processing failed") from e
```

### Performance Optimization
1. Frontend:
   - Use React.memo for expensive components
   - Implement virtualization for long lists
   - Optimize bundle size with code splitting
   - Use WebP images with fallbacks

2. Backend:
   - Cache expensive operations
   - Use database indexes effectively
   - Implement pagination for large datasets
   - Stream large files

## Development Tools

### Required Extensions
- VS Code
  - ESLint
  - Prettier
  - Python
  - TypeScript
  - EditorConfig

### Recommended Tools
- Postman for API testing
- wscat for WebSocket testing
- pgAdmin for database management
- React Developer Tools

## Debugging

### Backend Debugging
```python
# Enable debug mode
export FLASK_DEBUG=1
export FLASK_ENV=development

# Run with debugger
python -m debugpy --listen 5678 run.py
```

### Frontend Debugging
```bash
# Enable source maps
GENERATE_SOURCEMAP=true npm start

# Debug WebSocket
localStorage.setItem('debug', 'websocket:*');
```

## Documentation

### Code Documentation
- Use JSDoc for TypeScript/JavaScript
- Use docstrings for Python
- Document complex algorithms
- Keep README files updated

### API Documentation
- Update OpenAPI/Swagger specs
- Document WebSocket events
- Include request/response examples
- Document error responses

## Security Guidelines

1. Input Validation
   - Validate all user input
   - Sanitize file paths
   - Use parameterized queries

2. Authentication
   - Use secure session handling
   - Implement proper token management
   - Follow OAuth2 best practices

3. File Operations
   - Validate file types
   - Scan for malware
   - Use secure file operations

## Monitoring and Logging

### Logging Guidelines
```python
# Good: Structured logging with context
logger.info("Processing media file", extra={
    "file_path": file_path,
    "file_size": file_size,
    "user_id": user_id
})
```

### Monitoring Points
- API response times
- WebSocket connection status
- Media processing queue
- Cache hit rates
- Error rates

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

Remember to:
- Follow the style guide
- Write tests
- Update documentation
- Add to CHANGELOG.md 