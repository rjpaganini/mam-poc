// frontend/src/config.js
// Central configuration for the frontend application

// Get API port from environment or use default
const getAPIPort = () => process.env.REACT_APP_API_PORT || 5001;

// Get API host from environment or use default
const getAPIHost = () => process.env.REACT_APP_API_HOST || 'localhost';

// Build base URLs using host and port
const API_PORT = getAPIPort();
const API_HOST = getAPIHost();
const API_BASE = `http://${API_HOST}:${API_PORT}`;
const WS_BASE = `ws://${API_HOST}:${API_PORT}`;

const config = {
    // API Configuration - all endpoints and connection settings
    api: {
        // Core connection settings
        port: API_PORT,
        host: API_HOST,
        baseURL: API_BASE,
        wsURL: `${WS_BASE}/ws`,  // Fixed WebSocket endpoint
        mediaURL: `${API_BASE}/api/v1/media`,  // Add explicit mediaURL
        thumbnailURL: `${API_BASE}/api/v1/thumbnails`,  // Add explicit thumbnailURL
        
        // API endpoints - all prefixed with /api/v1
        endpoints: {
            health: '/api/v1/health/status',  // Fixed health endpoint
            assets: '/api/v1/assets',
            media: '/api/v1/media',
            thumbnails: '/api/v1/thumbnails',
            scan: '/api/v1/scan',
            debug: '/api/v1/debug/paths'
        },
        
        // Connection settings
        timeout: 30000,        // 30 second timeout
        retryAttempts: 3,      // Number of retry attempts
        retryDelay: 1000      // Delay between retries in ms
    },

    // Media Configuration
    media: {
        basePath: process.env.REACT_APP_MEDIA_BASE_PATH || '/Users/rjpaganini/Library/CloudStorage/GoogleDrive-rjpaganini@gmail.com/My Drive/Business/Valen Media/valn.io/exploration/valn.io/Data/Raw_Videos',
        supportedExtensions: ['.mp4', '.mov', '.avi', '.mkv']
    },

    // UI Configuration
    theme: {
        // Colors
        colors: {
            background: '#000000',
            surface: '#111111',
            border: '#222222',
            hover: '#FF0000', // Bright red for hover states
            text: {
                primary: '#FFFFFF',
                secondary: '#999999'
            },
            primary: '#FFFFFF',
            accent: '#FF0000',
            success: '#00FF00',
            warning: '#FFC107',
            error: '#FF0000'
        },
        
        // Typography configuration
        typography: {
            fontFamily: {
                base: 'Menlo, Monaco, "Courier New", monospace',
                code: 'Menlo, Monaco, "Courier New", monospace'
            },
            fontWeight: {
                normal: 400,
                medium: 500,
                bold: 600
            },
            fontSize: {
                xs: '0.75rem',
                sm: '0.875rem',
                md: '1rem',
                lg: '1.125rem',
                xl: '1.25rem'
            }
        },
        
        // Spacing
        spacing: {
            xs: '4px',
            sm: '8px',
            md: '16px',
            lg: '32px',
            xl: '64px'
        },
        
        // Border radius
        radius: {
            sm: '2px',
            md: '4px',
            lg: '6px'
        }
    },

    ui: {
        polling: {
            status: 5000,  // 5 seconds
            logs: 10000    // 10 seconds
        }
    },

    debug: process.env.REACT_APP_DEBUG === 'true',
};

export default config; 