# Developer Onboarding Guide

Version: 1.0.2
Last Updated: February 13, 2025
For: New developers joining the MAM project

## Welcome! 👋

This guide will help you get started with the Media Asset Manager (MAM) project. We'll walk through everything step by step.

## 1. First Steps

### 1.1 Setup Your Development Environment
```bash
# Required tools
Python 3.12.1 or higher
Node.js 18.19.0 or higher
FFmpeg 6.1 or higher
SQLite 3.x
Git
```

### 1.2 Clone and Setup
```bash
# Clone the repository
git clone <repository-url>
cd mam-poc

# Initial setup
./scripts/mam env setup
```

### 1.3 Configure Environment
```bash
# Copy example config
cp .env.example .env

# Edit .env with your settings
# Key settings to change:
MEDIA_ROOT=/path/to/your/media
CLOUD_STORAGE_PATH=/path/to/google/drive
```

## 2. Key Files to Understand

### 2.1 Backend Core (Priority: High)
```
backend/
├── app/
│   ├── main.py          # Application entry point
│   ├── routes/
│   │   └── media.py     # Core API endpoints
│   ├── models.py        # Database models
│   └── websocket.py     # Real-time updates
```

### 2.2 Frontend Core (Priority: High)
```
frontend/
├── src/
│   ├── App.tsx                    # Main application
│   ├── components/
│   │   ├── MediaLibrary/         # Core media browser
│   │   └── AssetDetails.tsx      # Asset viewer
│   └── services/
│       ├── api.ts                # API client
│       └── socket.ts             # WebSocket client
```

### 2.3 Configuration (Priority: Medium)
```
├── backend/app/config.py    # Backend configuration
├── frontend/src/config.ts   # Frontend configuration
└── .env                     # Environment variables
```

## 3. Understanding the Architecture

### 3.1 Core Components
1. **Flask Backend**
   - RESTful API for media management
   - WebSocket server for real-time updates
   - SQLite database for metadata

2. **React Frontend**
   - Media browser interface
   - Real-time status updates
   - Asset viewer and processor

3. **Electron App**
   - Native desktop application
   - Local file system access
   - Media streaming capabilities

4. **Services**
   - FFmpeg for media processing
   - WebSocket for real-time communication
   - File system for media storage

## 4. Development Workflow

### 4.1 Starting the Services
```bash
# Start all services
./scripts/mam start

# Start individual services
./scripts/mam start backend
./scripts/mam start frontend
./scripts/mam start electron
```

### 4.2 Common Development Tasks
```bash
# Check service status
./scripts/mam status

# View logs
./scripts/mam logs

# Run tests
./scripts/mam test backend
./scripts/mam test frontend

# Check health
./scripts/mam health
```

## 5. Key Documentation to Read (In Order)

1. [README.md](../../README.md) - Project overview
2. [ARCHITECTURE.md](../ARCHITECTURE.md) - System design
3. [API.md](../API.md) - API endpoints
4. [DEVELOPMENT.md](../DEVELOPMENT.md) - Development guidelines

## 6. Common Development Scenarios

### 6.1 Adding a New API Endpoint
1. Add route in `backend/app/routes/media.py`
2. Add tests in `backend/tests/`
3. Update API documentation
4. Add frontend service method in `frontend/src/services/api.ts`

### 6.2 Adding a New Feature
1. Create feature branch: `git checkout -b feature/name`
2. Implement backend changes
3. Add tests
4. Implement frontend changes
5. Update documentation
6. Create pull request

## 7. Debugging Tips

### 7.1 Backend Issues
```bash
# Check backend status
./scripts/mam status

# View backend logs
./scripts/mam logs backend

# Check database
./scripts/mam db verify
```

### 7.2 Frontend Issues
```bash
# Check frontend status
./scripts/mam status

# View frontend logs
./scripts/mam logs frontend

# Restart frontend
./scripts/mam restart frontend
```

### 7.3 Common Issues
1. Service not starting: Use `./scripts/mam status`
2. Database issues: Run `./scripts/mam db verify`
3. Media not loading: Check `./scripts/mam maint verify`
4. Environment issues: Run `./scripts/mam env check`

## 8. Best Practices

### 8.1 Code Style
- Follow PEP 8 for Python
- Use ESLint rules for TypeScript/JavaScript
- Write tests for new features
- Document your code
- Keep functions small and focused

### 8.2 Git Workflow
- Keep commits focused
- Write clear commit messages
- Update documentation with changes
- Add tests for new features
- Reference issues in commits

## 9. Getting Help

### 9.1 When Stuck
1. Check service status: `./scripts/mam status`
2. View relevant logs: `./scripts/mam logs`
3. Review [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
4. Search existing issues
5. Ask for help with:
   - What you're trying to do
   - What you've tried
   - Relevant logs
   - Error messages

### 9.2 Key Resources
- Project Documentation: `docs/` directory
- API Documentation: `docs/API.md`
- Troubleshooting: `docs/TROUBLESHOOTING.md`
- Change History: `CHANGELOG.md`

## 10. Next Steps

1. Set up your development environment
2. Run the application locally
3. Review the core documentation
4. Make a small test change
5. Run the test suite
6. Explore the codebase

Remember:
- Take your time to understand the architecture
- Don't hesitate to ask questions
- Write tests for your changes
- Keep documentation updated
- Use the debugging tools available

Welcome to the team! 🚀 