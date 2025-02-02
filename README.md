# Media Asset Manager (MAM)

Enterprise-grade media asset management system optimized for video content.

## 🚀 Quick Start

1. Copy `.env.example` to `.env` and configure your media path:
```bash
cp .env.example .env
# Edit .env and set MEDIA_BASE_PATH to your media directory
```

2. **Double-click** `launch_mam.command` on your desktop
3. Wait for services to start (you'll see progress indicators)
4. The web interface will open automatically at http://localhost:3001
5. To stop everything, press `Ctrl+C` in the terminal window

## ✨ Key Features

- 🎥 Real-time video preview with scrubbing
- 📊 Automatic metadata extraction (resolution, FPS, duration, size)
- 🔍 Smart search with instant filtering
- 📱 Grid and list views with sorting
- 🎯 Direct filesystem integration
- ⚡️ Efficient video streaming with range requests
- 🔄 One-click media scanning
- 🖼 Robust thumbnail generation with retry logic
- 💾 Client-side thumbnail caching
- 🔁 Automatic error recovery
- 📝 Comprehensive logging

## 🛠 Development Setup

### Prerequisites
```bash
# macOS
brew install python@3.11 node@18 ffmpeg

# Linux
apt install python3.11 nodejs ffmpeg

# Windows
choco install python311 nodejs ffmpeg
```

### Configuration

The application uses environment variables for configuration. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Required Configuration:
- `MEDIA_BASE_PATH`: Root directory containing your media files

Optional Configuration:
- `API_HOST`: API host (default: 127.0.0.1)
- `API_PORT`: API port (default: 5001)
- `FRONTEND_PORT`: Frontend port (default: 3001)
- `MAX_VIDEO_SIZE`: Maximum video file size in bytes (default: 10GB)
- `MAX_IMAGE_SIZE`: Maximum image file size in bytes (default: 1GB)

### Manual Installation
```bash
# Clone repository
git clone https://github.com/yourusername/mam-poc.git
cd mam-poc

# Backend setup
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Frontend setup
cd ../frontend
npm install
```

## 📖 Usage Guide

### Adding New Media
1. Drop media files into your configured media directory
2. Click "🔍 Scan Media" in the web interface
3. New assets will appear automatically with generated thumbnails

### Supported Formats
- Video: `.mp4`, `.mov`, `.avi`, `.mkv`
- Images: `.jpg`, `.png`, `.gif`
- Automatic MIME type detection
- Range request support for efficient streaming

### Features
- **Real-time Preview**: Hover over videos to preview with scrubbing
- **Smart Search**: Filter by name, type, or metadata
- **Grid/List Views**: Toggle between viewing modes
- **Sort Options**: Order by duration, size, resolution, etc.
- **Direct Access**: Open files in Finder/Explorer
- **Robust Thumbnails**: Automatic generation with retry logic
- **Caching**: Client-side thumbnail caching for performance

## 🏗 Architecture

```
mam-poc/
├── backend/                 # Flask API server
│   ├── app/
│   │   ├── routes.py       # API endpoints
│   │   ├── models.py       # Database models
│   │   └── utils/
│   │       └── extract_metadata.py  # Media processing
│   └── data/               # SQLite database
├── frontend/               # React application
│   ├── src/
│   │   ├── components/
│   │   │   └── MediaLibrary/
│   │   │       └── AssetCard.js    # Media preview component
│   │   └── utils/          # Frontend utilities
│   └── public/             # Static assets
└── launch_mam.command      # One-click launcher
```

## 🎓 Key Learnings & Best Practices

### API Route Consistency
- All API endpoints must use `/api/v1` prefix for consistency
- Frontend config should centralize API URL construction
- Thumbnail URLs in database should be relative paths
- Use URL transformation helpers for consistent path handling

### Thumbnail Generation
- Generated in a separate directory next to media files
- Uses FFmpeg for reliable frame extraction
- Implements retry logic with corruption detection
- Validates thumbnail size to detect generation issues
- Stores paths relative to media root for portability

### File Path Handling
- Use absolute paths in backend for reliability
- Store relative paths in database for portability
- Handle spaces and special characters in filenames
- Validate media access before serving files
- Use URL encoding for special characters in paths

### WebSocket Integration
- Used for real-time thumbnail generation progress
- Implements automatic reconnection logic
- Handles connection state in frontend
- Provides fallback to polling when needed
- Manages WebSocket lifecycle with React hooks

### Frontend Asset Management
- Implements progressive loading for performance
- Uses placeholder states during loading
- Handles video preloading efficiently
- Manages thumbnail/video state transitions
- Implements client-side caching for thumbnails

### Error Handling & Recovery
- Implements exponential backoff for retries
- Validates media files before serving
- Handles CORS properly for media access
- Provides meaningful error messages
- Implements graceful fallbacks

## 🔌 API Endpoints

```typescript
GET    /api/v1/assets           // List all assets
GET    /api/v1/assets/:id       // Get single asset
GET    /api/v1/thumbnails/:id   // Get asset thumbnail
POST   /api/v1/scan             // Scan for new media
POST   /api/v1/open-folder      // Open in filesystem
```

## 🚨 Error Handling

- Automatic retry for thumbnail generation (3 attempts)
- Corrupted thumbnail detection and cleanup
- Client-side retry with exponential backoff
- Comprehensive error logging
- Graceful fallback to placeholder images

## 🔧 Known Issues & Solutions

### Thumbnail Generation
- ✅ Fixed: 404 errors for thumbnails due to incorrect URL paths
- ✅ Fixed: Missing thumbnails due to generation failures
- ✅ Fixed: Inconsistent URL prefixes between frontend and backend
- 🔄 Monitor: Potential race conditions during concurrent generation

### Media Access
- ✅ Fixed: CORS issues with video streaming
- ✅ Fixed: Special character handling in filenames
- ✅ Fixed: Range request support for large files
- 🔄 Monitor: Memory usage during concurrent video streams

### WebSocket Communication
- ✅ Fixed: Connection stability issues
- ✅ Fixed: Real-time progress updates
- ✅ Fixed: Automatic reconnection handling
- 🔄 Monitor: Performance under high concurrency

## 🚀 Production Deployment

```bash
# Backend
cd backend
gunicorn -w 4 -b 0.0.0.0:5001 'app:create_app()'

# Frontend
cd frontend
npm run build
serve -s build
```

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.
