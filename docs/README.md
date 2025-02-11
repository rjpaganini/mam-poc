# Media Asset Manager (MAM) Documentation

## Documentation Structure

```
docs/
├── README.md               # This file - Documentation entry point
├── getting-started/        # Getting started guides
│   └── quickstart.md      # Quick start guide
├── architecture/          # System architecture
│   └── README.md         # Technical architecture
├── api/                  # API documentation
│   └── README.md        # API reference
├── development/         # Development guidelines
│   ├── backend.md      # Backend development
│   └── frontend.md     # Frontend development
└── deployment/         # Deployment guides
    └── README.md      # Deployment guide
```

## Quick Links

- 🚀 [Quick Start Guide](getting-started/quickstart.md)
- 🏗️ [System Architecture](architecture/README.md)
- 📚 [API Reference](api/README.md)
- 💻 [Development Guide](development/README.md)
- 🚀 [Deployment Guide](deployment/README.md)

## Core Documentation

1. **[Architecture](architecture/README.md)**
   - System components and interactions
   - WebSocket protocol (v1.0.1)
   - File handling and security
   - Data flow and state management

2. **[API Reference](api/README.md)**
   - REST API endpoints
   - WebSocket events
   - Authentication
   - Error handling

3. **[Development](development/README.md)**
   - Setup and configuration
   - Development workflow
   - Testing and debugging
   - Best practices

4. **[Deployment](deployment/README.md)**
   - Environment setup
   - Production deployment
   - Monitoring and maintenance
   - Troubleshooting

## Recent Updates (v1.0.1)

- Enhanced WebSocket stability with 25-second heartbeat
- Improved file access security through API endpoints
- Updated asset loading with delayed warnings
- Enhanced thumbnail caching and management
- Improved Google Drive integration

## Quick Reference

### Key URLs
- Backend API: `http://localhost:5001/api/v1`
- Frontend Dev: `http://localhost:3001`
- WebSocket: `ws://localhost:5001/ws`

### Common Commands
```bash
# Start all services
./scripts/launch.sh start

# Check system health
curl http://localhost:5001/api/v1/health/status

# Monitor logs
tail -f logs/*.log
```

## Contributing

See [CONTRIBUTING.md](development/contributing.md) for development guidelines.

## License

Copyright © 2024 Valen Media. All rights reserved. 