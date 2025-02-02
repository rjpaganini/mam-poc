// frontend/src/config.js
// Central configuration for the frontend application

// Get API port from environment or try common development ports
const getAPIPort = () => {
    const envPort = process.env.REACT_APP_API_PORT;
    if (envPort) return envPort;
    return 5001;  // Default to 5001
};

const API_PORT = getAPIPort();
const API_HOST = process.env.REACT_APP_API_HOST || 'localhost';
const API_BASE = `http://${API_HOST}:${API_PORT}`;
const WS_BASE = `ws://${API_HOST}:${API_PORT}`;  // WebSocket should use same port as API

const config = {
    // API Configuration
    api: {
        host: process.env.REACT_APP_API_HOST || 'localhost',
        port: parseInt(process.env.REACT_APP_API_PORT || '5001', 10),
        get baseURL() {
            return `http://${this.host}:${this.port}`;
        },
        wsURL: WS_BASE,  // Add WebSocket base URL
        get mediaURL() {
            return `${this.baseURL}/api/v1/media`;  // Add api/v1 prefix to match backend route
        },
        get thumbnailURL() {
            return `${this.baseURL}/api/v1/thumbnails`;  // Add api/v1 prefix for thumbnails
        },
        endpoints: {
            assets: '/api/v1/assets',
            directories: '/api/v1/directories',
            scan: '/api/v1/scan',
            health: '/api/v1/health',
            openFolder: '/api/v1/open-folder',
            ws: '/ws'  // WebSocket endpoint
        },
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000
    },

    // Media Configuration
    media: {
        basePath: process.env.REACT_APP_MEDIA_BASE_PATH || '/Users/rjpaganini/Library/CloudStorage/GoogleDrive-rjpaganini@gmail.com/My Drive/Business/Valen Media/valn.io/exploration/valn.io/Data/Raw_Videos',
        supportedExtensions: ['.mp4', '.mov', '.avi', '.mkv']
    },

    // UI Configuration
    theme: {
        colors: {
            primary: '#6366f1',
            background: '#1a1a1a',
            surface: '#2a2a2a',
            surfaceHover: '#383838',
            border: '#404040',
            text: {
                primary: '#ffffff',
                secondary: '#a3a3a3'
            },
            error: '#ef4444',
            success: '#22c55e',
            warning: '#ff9800',
        },
        spacing: {
            xs: '0.25rem',
            sm: '0.5rem',
            md: '1rem',
            lg: '1.5rem',
            xl: '2rem'
        },
        radius: {
            sm: '0.25rem',
            md: '0.5rem',
            lg: '0.75rem'
        },
        fontSize: {
            sm: '0.875rem',
            md: '1rem',
            lg: '1.25rem',
            xl: '1.5rem'
        },
        fontWeight: {
            normal: 400,
            medium: 500,
            bold: 700
        }
    },

    ui: {
        polling: {
            status: 5000,  // 5 seconds
            logs: 10000    // 10 seconds
        }
    }
};

export default config; 