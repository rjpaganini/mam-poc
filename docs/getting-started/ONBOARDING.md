# Developer Onboarding Guide

Version: 1.0.1
Last Updated: February 10, 2025
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
PostgreSQL 14.10 or higher
Git
```

### 1.2 Clone and Setup
```bash
# Clone the repository
git clone <repository-url>
cd mam-poc

# Setup Python environment
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt

# Setup Frontend
cd frontend
npm install
cd ..
```

### 1.3 Configure Environment
```bash
# Copy example config
cp .env.example .env

# Edit .env with your settings
# Key settings to change:
MEDIA_ROOT=/path/to/your/media
DATABASE_URL=postgresql://localhost/mam
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
│   ├── App.js                      # Main application
│   ├── components/
│   │   ├── MediaLibrary/          # Core media browser
│   │   └── AssetDetails.js        # Asset viewer
│   └── services/
│       ├── api.js                 # API client
│       └── socket.js              # WebSocket client
```

### 2.3 Configuration (Priority: Medium)
```
├── backend/app/config.py    # Backend configuration
├── frontend/src/config.js   # Frontend configuration
└── .env                     # Environment variables
```

## 3. Understanding the Architecture

### 3.1 Core Components
1. **Flask Backend**
   - RESTful API for media management
   - WebSocket server for real-time updates
   - PostgreSQL database for metadata

2. **React Frontend**
   - Media browser interface
   - Real-time status updates
   - Asset viewer and processor

3. **Services**
   - FFmpeg for media processing
   - WebSocket for real-time communication
   - File system for media storage

## 4. Development Workflow

### 4.1 Starting the Services
```bash
# Start backend (Terminal 1)
source venv/bin/activate
python run.py

# Start frontend (Terminal 2)
cd frontend
npm start
```

### 4.2 Common Development Tasks
```bash
# Run backend tests
python -m pytest

# Run frontend tests
cd frontend && npm test

# Check API health
curl http://localhost:5001/api/v1/health/status

# View logs
tail -f logs/backend.log
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
4. Add frontend service method in `frontend/src/services/api.js`

### 6.2 Adding a New Feature
1. Create feature branch: `git checkout -b feature/name`
2. Implement backend changes
3. Add tests
4. Implement frontend changes
5. Update documentation
6. Create pull request

## 7. Debugging Tips

### 7.1 Backend Issues
```python
# Add debug logging
import logging
logging.debug("Debug info:", variable)

# Use debugger
import pdb; pdb.set_trace()
```

### 7.2 Frontend Issues
```javascript
// Console logging
console.debug('Debug info:', data);

// React DevTools
// Chrome DevTools -> Components tab
```

### 7.3 Common Issues
1. Port conflicts: Check `lsof -i :5001`
2. Database connection: Check PostgreSQL service
3. Media not loading: Verify file permissions
4. WebSocket issues: Check CORS settings

## 8. Best Practices

### 8.1 Code Style
- Follow PEP 8 for Python
- Use ESLint rules for JavaScript
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
1. Check logs first
2. Review [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
3. Search existing issues
4. Ask for help with:
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