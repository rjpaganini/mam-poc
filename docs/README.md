# Media Asset Manager (MAM) Documentation

Version: 1.0.2
Last Updated: February 13, 2025

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
- 📝 [Changelog](../CHANGELOG.md)

## Core Documentation

1. **[Architecture](architecture/README.md)**
   - System components and interactions
   - WebSocket protocol (v1.0.2)
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

## Recent Updates (v1.0.2)

- Improved service management with enhanced `launch.sh` script
- Consolidated WebSocket and API on port 5001
- Enhanced health checks and logging
- Added AWS integration for advanced processing
- Improved error handling and startup diagnostics
- Added automatic log rotation

## Quick Reference

### Key URLs
- Backend API & WebSocket: `http://localhost:5001`
- Frontend Dev: `http://localhost:3001`
- WebSocket: `ws://localhost:5001/ws`

### Common Commands
```bash
# Start all services
./scripts/launch.sh start

# Restart services (with health checks)
./scripts/launch.sh restart

# Stop services
./scripts/launch.sh stop

# Check system health
curl http://localhost:5001/api/v1/health/status

# Monitor logs
tail -f logs/*.log
```

## Contributing

See [CONTRIBUTING.md](development/contributing.md) for development guidelines.

## License

Copyright © 2025 Valen Media. All rights reserved. 