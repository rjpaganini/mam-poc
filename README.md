# Media Asset Management Platform (MAM)

A lightweight, local media asset management platform for organizing and accessing media files.

## 🚀 Quick Start

1. Double-click `launch_mam.command` on your desktop
2. Wait for all services to start
3. The application will open automatically

## 🔧 System Architecture

The platform consists of three main services:

### Backend Service (Port 5001)
- Flask-based REST API
- Handles media scanning and metadata extraction
- Manages the SQLite database
- Auto-reloads in development mode for quick iterations

### Frontend Service (Port 3001)
- React-based user interface
- Real-time media browsing
- Thumbnail generation and preview
- Communicates with backend API

### Electron Application
- Desktop application wrapper
- Native system integration
- Direct file system access

## 🛠 Development Mode (Default)

The application runs in development mode by default, providing:
- Auto-reload for backend changes
- Hot-reload for frontend changes
- Detailed logging
- Enhanced error messages

To start in development mode:
```bash
# Just double-click launch_mam.command
# Or run from terminal:
./launch_mam.command
```

## 🏭 Production Mode

For testing production behavior:
```bash
DEV_MODE=false ./launch_mam.command
```

Production mode features:
- Disabled auto-reloader
- Optimized performance
- Minimal logging
- Stable process management

## 📊 Logging

All logs are stored in the `logs` directory:
- `launcher.log`: Service startup/shutdown logs
- `backend.log`: Flask API logs
- `frontend.log`: React development server logs
- `electron.log`: Desktop application logs

Logs automatically rotate when they exceed 10MB.

## 🔍 Troubleshooting

### Port Conflicts
If you see "port already in use" errors:
1. Close the application
2. Double-click `launch_mam.command` again
   - It will automatically clean up existing processes
   - Start fresh instances of all services

### Service Issues
If any service fails to start:
1. Check the specific service log in the `logs` directory
2. Ensure all dependencies are installed
3. Verify port availability

### Common Solutions
- **Backend Issues**: Check `backend.log` for Python errors
- **Frontend Issues**: Check `frontend.log` for npm/React errors
- **Electron Issues**: Check `electron.log` for startup errors

## 🔄 Services Communication

```
Electron App
     ↕️
React Frontend (3001) ←→ Flask Backend (5001)
     ↕️                        ↕️
  UI/Assets              Local Media Files
```

## 📁 Project Structure
```
mam-poc/
├── backend/            # Flask API server
│   ├── .venv/         # Python virtual environment
│   └── requirements.txt
├── frontend/          # React application
│   ├── node_modules/
│   └── package.json
├── logs/             # Application logs
├── pids/             # Process IDs for management
└── launch_mam.command # Main launcher script
```

## 🛡️ Error Handling

The launcher script provides:
- Dependency verification
- Port availability checking
- Process cleanup
- Service health monitoring
- Automatic recovery attempts
- Clear error messages

## 🔐 Security Notes

- Application runs locally only
- No external network access required
- File access limited to configured media directory
- No sensitive data storage

## 📝 Development Notes

- Built as a proof of concept
- Focuses on local media management
- Designed for easy debugging
- Emphasizes reliability over complexity

## 🆘 Support

Check the logs in the following order when troubleshooting:
1. `launcher.log` - For startup issues
2. `backend.log` - For API/database issues
3. `frontend.log` - For UI issues
4. `electron.log` - For desktop app issues
