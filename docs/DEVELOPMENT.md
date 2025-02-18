# Development Guide

Version: 1.0.2
Last Updated: February 13, 2025
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
│   │   ├── pages/        # Route components
│   │   └── components/   # Reusable components
│   ├── macos/            # Electron main process
│   └── tests/            # Frontend tests
├── data/                 # Database and thumbnails
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

### TypeScript/JavaScript (Frontend)
- Use ESLint config
- Max line length: 100
- Document components
- Follow component hierarchy (pages -> components)

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

## Service Management

### Starting Services
```bash
# Start all services
./scripts/mam start

# Start specific services
./scripts/mam start backend
./scripts/mam start frontend
./scripts/mam start electron

# Stop services
./scripts/mam stop

# Restart services
./scripts/mam restart
```

### Health and Status
```bash
# Check service status
./scripts/mam status

# Detailed health check
./scripts/mam health

# Environment check
./scripts/mam env check
```

### Logs
```bash
# View all logs
./scripts/mam logs

# View specific logs
./scripts/mam logs backend
./scripts/mam logs frontend
```

### Database Management
```bash
# Initialize database
./scripts/mam db init

# Verify database
./scripts/mam db verify

# Create backup
./scripts/mam db backup

# Merge database
./scripts/mam db merge <path>
```

### Maintenance
```bash
# Regenerate thumbnails
./scripts/mam maint thumbnails

# Check media durations
./scripts/mam maint durations

# Clean temporary files
./scripts/mam maint cleanup

# Verify media files
./scripts/mam maint verify
```

## WebSocket Development

### Connection Setup
```