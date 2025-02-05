import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Box, CircularProgress, ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import MediaLibrary from './components/MediaLibrary';  // Import the main MediaLibrary component
import { AssetCard } from './components/MediaLibrary/AssetCard';
import ListView from './components/MediaLibrary/ListView';
import { ViewToggle } from './components/MediaLibrary/ViewToggle';
import config from './config';
import { assetsApi } from './services/api';
import SystemHealth from './components/SystemHealth';
import DirectoryManager from './components/DirectoryManager';
import AssetDetails from './components/AssetDetails';
import logger from './services/logger';
import { monitorThemeChanges } from './utils/themeDebug';
import { createMuiTheme } from './theme';

// Create MUI theme once
const theme = createTheme(createMuiTheme());

// Safely get nested theme values with fallbacks
const getThemeValue = (path, fallback) => {
    try {
        return path.split('.').reduce((obj, key) => obj[key], config.theme) ?? fallback;
    } catch (e) {
        logger.warn(`Theme value not found: ${path}, using fallback`, { fallback });
        return fallback;
    }
};

// Log theme application with error handling
const logThemeChange = (theme) => {
    try {
        logger.info('Theme configuration applied:', {
            colors: theme.palette,
            typography: theme.typography,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Failed to log theme configuration:', error);
    }
};

// Monitor theme in development
if (process.env.NODE_ENV === 'development') {
    monitorThemeChanges(theme);
}

// WebSocket message types
const WS_MESSAGE_TYPES = {
    SCAN_PROGRESS: 'scan_progress',
    SCAN_COMPLETE: 'scan_complete',
    SCAN_ERROR: 'scan_error',
    ERROR: 'error',
    CONNECTION_STATUS: 'connection_status',
    PING: 'ping',
    PONG: 'pong'
};

// Define the function to handle WebSocket messages
const handleWebSocketMessage = (data, callbacks) => {
    const { onScanProgress, onScanComplete, onError } = callbacks;
    
    try {
        // Validate message format
        if (!data || typeof data !== 'object' || !data.type) {
            throw new Error('Invalid message format');
        }
        
        switch (data.type) {
            case WS_MESSAGE_TYPES.SCAN_PROGRESS:
                onScanProgress?.(data.message);
                break;
            case WS_MESSAGE_TYPES.SCAN_COMPLETE:
                onScanComplete?.(data.data);
                break;
            case WS_MESSAGE_TYPES.SCAN_ERROR:
            case WS_MESSAGE_TYPES.ERROR:
                onError?.(data.message);
                break;
            case WS_MESSAGE_TYPES.CONNECTION_STATUS:
                logger.info('[WebSocket] Status:', data.message);
                break;
            case WS_MESSAGE_TYPES.PONG:
                logger.debug('[WebSocket] Received pong');
                break;
            default:
                logger.warn('[WebSocket] Unknown message type:', data.type);
        }
    } catch (error) {
        logger.error('[WebSocket] Message handling error:', error);
        onError?.('Failed to process WebSocket message');
    }
};

// WebSocket connection management
const useWebSocket = (callbacks) => {
    const [wsConnected, setWsConnected] = useState(false);
    const ws = useRef(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;
    const reconnectTimeout = useRef(null);
    const pingInterval = useRef(null);

    const cleanupConnection = useCallback(() => {
        if (pingInterval.current) {
            clearInterval(pingInterval.current);
            pingInterval.current = null;
        }
        if (reconnectTimeout.current) {
            clearTimeout(reconnectTimeout.current);
            reconnectTimeout.current = null;
        }
        if (ws.current) {
            try {
                ws.current.close();
            } catch (err) {
                logger.error('[WebSocket] Error closing connection:', err);
            }
            ws.current = null;
        }
    }, []);

    const connect = useCallback(() => {
        try {
            cleanupConnection();

            const wsUrl = `ws://${config.api.host}:${config.api.port}/ws`;
            logger.info('[WebSocket] Attempting connection to:', wsUrl);

            const socket = new WebSocket(wsUrl);
            ws.current = socket;

            // Set a connection timeout
            const connectionTimeout = setTimeout(() => {
                if (socket.readyState !== WebSocket.OPEN) {
                    logger.error('[WebSocket] Connection timeout');
                    socket.close();
                }
            }, 5000);

            socket.onopen = () => {
                clearTimeout(connectionTimeout);
                logger.info('[WebSocket] Connection established');
                setWsConnected(true);
                reconnectAttempts.current = 0;

                // Start ping interval
                pingInterval.current = setInterval(() => {
                    if (socket.readyState === WebSocket.OPEN) {
                        try {
                            socket.send(JSON.stringify({ type: WS_MESSAGE_TYPES.PING }));
                        } catch (err) {
                            logger.error('[WebSocket] Failed to send ping:', err);
                            socket.close();
                        }
                    }
                }, 30000); // Ping every 30 seconds
            };

            socket.onclose = (event) => {
                clearTimeout(connectionTimeout);
                logger.info(`[WebSocket] Connection closed: ${event.code} - ${event.reason}`);
                setWsConnected(false);
                cleanupConnection();

                if (reconnectAttempts.current < maxReconnectAttempts) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
                    logger.info(`[WebSocket] Attempting to reconnect in ${delay}ms...`);
                    reconnectTimeout.current = setTimeout(() => {
                        reconnectAttempts.current++;
                        connect();
                    }, delay);
                } else {
                    logger.error('[WebSocket] Max reconnection attempts reached');
                }
            };

            socket.onerror = (error) => {
                logger.error('[WebSocket] Error:', error);
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    handleWebSocketMessage(data, callbacks);
                } catch (error) {
                    logger.error('[WebSocket] Failed to parse message:', error);
                    callbacks.onError?.('Failed to process WebSocket message');
                }
            };
        } catch (error) {
            logger.error('[WebSocket] Failed to establish connection:', error);
            if (reconnectAttempts.current < maxReconnectAttempts) {
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
                reconnectTimeout.current = setTimeout(() => {
                    reconnectAttempts.current++;
                    connect();
                }, delay);
            }
        }
    }, [callbacks, cleanupConnection]);

    // Initialize connection on mount and cleanup on unmount
    useEffect(() => {
        connect();
        return cleanupConnection;
    }, [connect, cleanupConnection]);

    return {
        isConnected: wsConnected,
        reconnect: () => {
            reconnectAttempts.current = 0;
            connect();
        }
    };
};

// Updated styles using MUI theme spacing
const styles = {
    app: {
        minHeight: '100vh',
        backgroundColor: getThemeValue('colors.background', '#000000'),
        color: getThemeValue('colors.text.primary', '#FFFFFF')
    },
    container: {
        maxWidth: '1400px',
        margin: '0 auto'
    },
    title: {
        color: getThemeValue('colors.text.primary', '#FFFFFF'),
        textAlign: 'center'
    },
    searchSection: {
        backgroundColor: getThemeValue('colors.surface', '#111111'),
        borderRadius: getThemeValue('radius.lg', '6px'),
        border: `1px solid ${getThemeValue('colors.border', '#222222')}`,
        maxWidth: '1400px',
        margin: '0 auto'
    },
    searchBar: {
        display: 'flex',
        gap: 2, // MUI spacing unit
        alignItems: 'center'
    },
    input: {
        flex: 1,
        backgroundColor: getThemeValue('colors.background', '#000000'),
        border: `1px solid ${getThemeValue('colors.border', '#222222')}`,
        borderRadius: getThemeValue('radius.md', '4px'),
        color: getThemeValue('colors.text.primary', '#FFFFFF'),
        fontSize: '16px'
    },
    button: {
        backgroundColor: getThemeValue('colors.primary', '#FFFFFF'),
        color: '#fff',
        border: 'none',
        borderRadius: getThemeValue('radius.md', '4px'),
        cursor: 'pointer',
        fontSize: '16px',
        '&:hover': {
            opacity: 0.9
        }
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 4 // MUI spacing unit
    },
    filterBar: {
        display: 'flex',
        gap: 2, // MUI spacing unit
        alignItems: 'center'
    },
    select: {
        backgroundColor: getThemeValue('colors.background', '#000000'),
        border: `1px solid ${getThemeValue('colors.border', '#222222')}`,
        borderRadius: getThemeValue('radius.md', '4px'),
        color: getThemeValue('colors.text.primary', '#FFFFFF'),
        fontSize: '16px'
    },
    assetCard: {
        backgroundColor: getThemeValue('colors.surface', '#111111'),
        borderRadius: getThemeValue('radius.md', '4px'),
        border: `1px solid ${getThemeValue('colors.border', '#222222')}`,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }
    },
    thumbnail: {
        position: 'relative',
        paddingTop: '56.25%',
        backgroundColor: getThemeValue('colors.background', '#000000'),
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderBottom: `1px solid ${getThemeValue('colors.border', '#222222')}`
    },
    cardContent: {
        padding: 3 // MUI spacing unit
    },
    metadataGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 1, // MUI spacing unit
        color: getThemeValue('colors.text.secondary', '#999999'),
        fontSize: '14px'
    },
    assetDetails: {
        padding: 4 // MUI spacing unit
    },
    videoContainer: {
        marginBottom: 3 // MUI spacing unit
    },
    header: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2, // MUI spacing unit
        marginBottom: 4 // MUI spacing unit
    },
    logo: {
        fontSize: getThemeValue('typography.fontSize.xl', '1.25rem'),
        color: getThemeValue('colors.text.primary', '#FFFFFF'),
        margin: 0
    }
};

/**
 * Main App component
 * Provides theme context and routing
 */
function App() {
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState('grid');
    const [sortBy, setSortBy] = useState('title');
    const [sortDirection, setSortDirection] = useState('asc');
    const [showDirectoryManager, setShowDirectoryManager] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTags, setSelectedTags] = useState([]);

    // Move loadAssets definition before its usage
    const loadAssets = useCallback(async (retryCount = 0) => {
        try {
            setLoading(true);
            setError(null); // Clear previous errors
            
            const data = await assetsApi.loadAssets();
            
            // Validate response data
            if (!Array.isArray(data)) {
                throw new Error('Invalid response format: expected array');
            }
            
            // Validate and transform assets
            const validatedAssets = data.filter(asset => {
                if (!asset?.id || !asset?.title) {
                    console.warn('Skipping invalid asset:', asset);
                    return false;
                }
                return true;
            }).map(asset => ({
                ...asset,
                // Ensure required fields have default values
                id: asset.id,
                title: asset.title || 'Untitled',
                description: asset.description || '',
                file_path: asset.file_path || '',
                file_size: Number(asset.file_size) || 0,
                media_metadata: {
                    ...asset.media_metadata,
                    duration: Number(asset.media_metadata?.duration) || 0,
                    fps: Number(asset.media_metadata?.fps) || 0,
                    bitrate: Number(asset.media_metadata?.bitrate) || 0,
                    width: Number(asset.media_metadata?.width) || 0,
                    height: Number(asset.media_metadata?.height) || 0,
                    codec: asset.media_metadata?.codec || '',
                    format: asset.media_metadata?.format || ''
                }
            }));
            
            setAssets(validatedAssets);
            
            // Log success for debugging
            console.log(`Loaded ${validatedAssets.length} assets successfully`);
            console.log('Sample asset:', validatedAssets[0]); // Log first asset for debugging
            
        } catch (err) {
            console.error('Failed to load assets:', err);
            
            // Implement retry logic
            if (retryCount < 3) {
                console.log(`Retrying asset load (attempt ${retryCount + 1}/3)...`);
                setTimeout(() => loadAssets(retryCount + 1), 1000 * Math.pow(2, retryCount));
                return;
            }
            
            setError(`Failed to load assets: ${err.message}`);
            setAssets([]); // Reset to empty array on final failure
        } finally {
            setLoading(false);
        }
    }, []);

    // Define callbacks before using them
    const wsCallbacks = useMemo(() => ({
        onScanProgress: (message) => {
            console.log('Scan progress:', message);
            // Update UI with scan progress
        },
        onScanComplete: (data) => {
            console.log('Scan complete:', data);
            loadAssets(); // Reload assets after scan
        },
        onError: (message) => {
            console.error('WebSocket error:', message);
            setError(message);
        }
    }), [loadAssets]);

    // Pass callbacks to useWebSocket
    const { isConnected: wsConnected, reconnect } = useWebSocket(wsCallbacks);

    // Use wsConnected in the UI to show connection status
    useEffect(() => {
        if (!wsConnected) {
            console.warn('WebSocket disconnected - some real-time features may be unavailable');
        }
    }, [wsConnected]);

    // Load assets on mount
    useEffect(() => {
        loadAssets();
    }, [loadAssets]);

    // Callback for when scan is complete
    const handleScanComplete = useCallback(() => {
        loadAssets();
        setShowDirectoryManager(false);
    }, [loadAssets]);

    // Add effect to monitor theme changes
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            monitorThemeChanges(theme);
            
            // Log when component mounts
            logger.info('App component mounted with theme:', {
                timestamp: new Date().toISOString()
            });
        }
    }, []);  // Empty dependency array - only run on mount

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
                {/* Draggable title bar */}
                <Box sx={{ 
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '38px',
                    WebkitAppRegion: 'drag',
                    WebkitUserSelect: 'none',
                    zIndex: 9999,
                    bgcolor: 'transparent'
                }} />
                
                {/* Main Header */}
                <Box sx={{
                    position: 'sticky',
                    top: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    px: 3,
                    py: 2,
                    mt: '38px',
                    bgcolor: 'background.default',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    zIndex: 1000
                }}>
                    {/* Logo */}
                    <Box sx={{ 
                        position: 'absolute',
                        left: '25%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        WebkitAppRegion: 'no-drag',
                        zIndex: 1
                    }}>
                        <Box component="h1" sx={{
                            color: 'text.primary',
                            fontSize: '0.9rem !important',
                            fontWeight: 'medium',
                            m: 0,
                            opacity: 0.9,
                            whiteSpace: 'nowrap',
                            fontFamily: theme => theme.typography.fontFamily.base,
                            textTransform: 'none'
                        }}>
                            valn.io
                        </Box>
                    </Box>

                    {/* Layout spacer */}
                    <Box sx={{ width: '100px' }} />

                    {/* Controls */}
                    <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 2,
                        WebkitAppRegion: 'no-drag',
                        zIndex: 2
                    }}>
                        {/* Scan Media Button - Minimalist black with white border */}
                        <Box
                            component="button"
                            onClick={() => setShowDirectoryManager(true)}
                            sx={{
                                px: 1.5,
                                py: 0.5,
                                height: '24px',
                                bgcolor: 'primary.main',
                                color: 'text.primary',
                                border: '1px solid',
                                borderColor: 'text.primary',
                                borderRadius: 1,
                                cursor: 'pointer',
                                fontSize: '0.7rem',
                                fontWeight: 'medium',
                                transition: 'all 0.2s ease',
                                '&:hover, &:focus': {
                                    borderColor: 'error.main',
                                    outline: 'none'
                                },
                                '&:active': {
                                    borderColor: 'error.main',
                                    transform: 'translateY(1px)'
                                }
                            }}
                        >
                            SCAN MEDIA
                        </Box>

                        <SystemHealth wsConnected={wsConnected} />
                    </Box>
                </Box>

                {/* Main content */}
                <Box sx={{ flex: 1, p: 2 }}>
                    <Routes>
                        <Route path="/" element={
                            <MediaLibrary 
                                assets={assets}
                                loading={loading}
                                error={error}
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                                sortBy={sortBy}
                                setSortBy={setSortBy}
                                sortDirection={sortDirection}
                                setSortDirection={setSortDirection}
                                viewMode={viewMode}
                                setViewMode={setViewMode}
                                setShowDirectoryManager={setShowDirectoryManager}
                                selectedTags={selectedTags}
                                setSelectedTags={setSelectedTags}
                            />
                        } />
                        <Route path="/asset/:id" element={<AssetDetails />} />
                    </Routes>
                </Box>

                {showDirectoryManager && (
                    <DirectoryManagerModal 
                        onClose={() => setShowDirectoryManager(false)}
                        onScanComplete={handleScanComplete}
                    />
                )}
            </Box>
        </ThemeProvider>
    );
}

// Separate modal component for better organization
const DirectoryManagerModal = ({ onClose, onScanComplete }) => (
    <Box sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
    }}>
        <Box sx={{
            backgroundColor: config.theme.colors.surface,
            borderRadius: config.theme.radius.lg,
            padding: 3,
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
        }}>
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2
            }}>
                <h2 style={{ margin: 0, color: config.theme.colors.text.primary }}>
                    Media Directories
                </h2>
                <button
                    onClick={onClose}
                    style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: config.theme.colors.text.secondary,
                        cursor: 'pointer',
                        padding: config.theme.spacing.sm
                    }}
                >
                    ✕
                </button>
            </Box>
            <DirectoryManager onScanComplete={onScanComplete} />
        </Box>
    </Box>
);

export default App;
