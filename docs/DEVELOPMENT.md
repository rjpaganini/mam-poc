# Development Guide

Version: 1.0.1
Last Updated: February 10, 2025
Minimum Requirements: Python 3.12.1, Node 18.19.0

## Project Structure
```
mam-poc/
├── backend/
│   ├── app/              # Main application code
│   ├── tests/            # Backend tests
│   └── scripts/          # Utility scripts
├── frontend/
│   ├── src/              # React components
│   ├── public/           # Static assets
│   └── tests/            # Frontend tests
└── scripts/              # Project scripts
```

## Code Style

### Python (Backend)
- Follow PEP 8
- Use type hints
- Max line length: 100
- Use docstrings for functions

Example:
```python
def process_media(asset_id: int) -> dict:
    """Process media asset and generate thumbnail.
    
    Args:
        asset_id: The ID of the asset to process
        
    Returns:
        Dict containing processing results
    """
    # Implementation
```

### TypeScript (Frontend)
- Use ESLint config
- Max line length: 100
- Use interfaces for types
- Document components

Example:
```typescript
interface AssetProps {
  id: number;
  title: string;
  onSelect: (id: number) => void;
}

const Asset: React.FC<AssetProps> = ({ id, title, onSelect }) => {
  // Implementation
};
```

## Common Scripts

### Backend
```bash
# Run tests
python -m pytest

# Type checking
mypy backend/

# Format code
black backend/
```

### Frontend
```bash
# Run tests
npm test

# Type checking
npm run typecheck

# Lint
npm run lint
```

## WebSocket Development

### Connection Lifecycle
1. Initial connection
2. Authentication
3. Subscribe to events
4. Handle messages
5. Reconnect on disconnect

Example:
```typescript
const ws = new WebSocket('ws://localhost:5001/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle message
};

ws.onclose = () => {
  // Implement reconnection logic
};
```

## Common Issues

### Port Conflicts
```bash
# Check ports in use
lsof -i :5001
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Database
```bash
# Reset database
python scripts/reset_db.py

# Backup
pg_dump mam > backup.sql
```

### Media Processing
- Check FFmpeg installation
- Verify file permissions
- Monitor logs/backend.log

## Testing

### Backend Tests
```bash
# Run all tests
python -m pytest

# Run specific test
python -m pytest tests/test_media.py

# With coverage
python -m pytest --cov=backend
```

### Frontend Tests
```bash
# Run all tests
npm test

# Run specific test
npm test -- AssetList.test.tsx

# With coverage
npm test -- --coverage
```

## Debugging

### Backend
```python
# Add logging
import logging
logging.debug("Processing asset:", asset_id)

# Use debugger
import pdb; pdb.set_trace()
```

### Frontend
```typescript
// Add console logging
console.debug('Asset data:', asset);

// Use React DevTools
// Chrome DevTools -> Components tab
```

## Security Best Practices
1. Validate all inputs
2. Sanitize file paths
3. Use prepared statements
4. Implement rate limiting
5. Log security events

## Performance Tips
1. Use connection pooling
2. Cache thumbnails
3. Implement pagination
4. Optimize media streams
5. Use WebSocket for real-time
``` 