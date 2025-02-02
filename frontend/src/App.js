import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { AssetCard } from './components/MediaLibrary/AssetCard';
import { ListView } from './components/MediaLibrary/ListView';
import { ViewToggle } from './components/MediaLibrary/ViewToggle';
import config from './config';
import { formatFileSize } from './utils/formatters';
import { openFolder } from './utils/fileUtils';
import { assetsApi } from './services/api';
import SystemHealth from './components/SystemHealth';
import DirectoryManager from './components/DirectoryManager';
import AssetDetails from './components/AssetDetails';
import { ThemeProvider, createTheme } from '@mui/material';

// Create theme instance
const theme = createTheme({
    palette: {
        primary: {
            main: config.theme.colors.primary,
        },
        background: {
            default: config.theme.colors.background,
            paper: config.theme.colors.surface,
        },
        text: {
            primary: config.theme.colors.text.primary,
            secondary: config.theme.colors.text.secondary,
        },
    },
    spacing: (factor) => `${0.25 * factor}rem`,
    shape: {
        borderRadius: config.theme.radius.md,
    },
});

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 1000; // 1 second

// WebSocket message types
const WS_MESSAGE_TYPES = {
    SCAN_PROGRESS: 'scan_progress',
    SCAN_COMPLETE: 'scan_complete',
    SCAN_ERROR: 'scan_error',
    ERROR: 'error',
    CONNECTION_STATUS: 'connection_status'
};

// Define the function to handle WebSocket messages
const handleWebSocketMessage = (data, callbacks) => {
    const { onScanProgress, onScanComplete, onError } = callbacks;
    
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
            console.log(data.message);
            break;
        default:
            console.warn('Unknown message type:', data.type);
    }
};

// WebSocket connection management with better error handling
const useWebSocket = (callbacks) => {
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef(null);
    const reconnectAttempts = useRef(0);
    const reconnectTimeout = useRef(null);
    const pingInterval = useRef(null);
    const maxReconnectAttempts = 5;
    const baseDelay = 1000;

    const connect = useCallback(() => {
        try {
            if (wsRef.current?.readyState === WebSocket.OPEN) return;

            // Clear existing connection and intervals
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            if (pingInterval.current) {
                clearInterval(pingInterval.current);
            }

            // Determine the correct WebSocket URL
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const ports = [5001, 5002]; // Try both ports
            const host = window.location.hostname || 'localhost';
            
            // Function to try connecting to a specific port
            const tryConnect = (port) => {
                const wsUrl = `${protocol}//${host}:${port}/ws`;
                console.log('Attempting WebSocket connection to:', wsUrl);
                
                return new Promise((resolve, reject) => {
                    const ws = new WebSocket(wsUrl);
                    
                    // Set a connection timeout
                    const connectionTimeout = setTimeout(() => {
                        ws.close();
                        reject(new Error('Connection timeout'));
                    }, 5000);
                    
                    ws.onopen = () => {
                        clearTimeout(connectionTimeout);
                        console.log('WebSocket connected successfully to port', port);
                        resolve(ws);
                    };
                    
                    ws.onerror = () => {
                        clearTimeout(connectionTimeout);
                        reject(new Error(`Failed to connect to port ${port}`));
                    };
                });
            };
            
            // Try connecting to each port in sequence
            const attemptConnection = async () => {
                for (const port of ports) {
                    try {
                        const ws = await tryConnect(port);
                        wsRef.current = ws;
                        setIsConnected(true);
                        reconnectAttempts.current = 0;
                        
                        // Set up WebSocket handlers
                        ws.onmessage = (event) => {
                            try {
                                const data = JSON.parse(event.data);
                                if (data.type === 'pong') return; // Ignore pong responses
                                handleWebSocketMessage(data, callbacks);
                            } catch (error) {
                                console.error('Error parsing WebSocket message:', error);
                            }
                        };
                        
                        ws.onclose = (event) => {
                            clearInterval(pingInterval.current);
                            setIsConnected(false);
                            console.log('WebSocket disconnected:', event.code, event.reason);
                            
                            // Don't reconnect if closed normally or max attempts reached
                            if (event.code === 1000 || event.code === 1001) return;
                            
                            if (reconnectAttempts.current < maxReconnectAttempts) {
                                const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts.current), 10000);
                                reconnectAttempts.current += 1;
                                console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
                                reconnectTimeout.current = setTimeout(connect, delay);
                            } else {
                                console.log('Max reconnection attempts reached');
                                callbacks.onError?.('WebSocket connection failed after maximum attempts');
                            }
                        };
                        
                        // Start ping interval
                        pingInterval.current = setInterval(() => {
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify({ type: 'ping' }));
                            }
                        }, 20000); // Send ping every 20 seconds
                        
                        return; // Successfully connected
                    } catch (error) {
                        console.log(`Failed to connect to port ${port}:`, error.message);
                        // Continue to next port
                    }
                }
                
                // If we get here, all ports failed
                throw new Error('Failed to connect to any available port');
            };
            
            attemptConnection().catch(error => {
                console.error('WebSocket connection failed:', error);
                callbacks.onError?.('Failed to establish WebSocket connection');
            });
            
        } catch (error) {
            console.error('Error establishing WebSocket connection:', error);
            setIsConnected(false);
            callbacks.onError?.('Failed to establish WebSocket connection');
        }
    }, [callbacks, maxReconnectAttempts, baseDelay]);

    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
            }
            if (pingInterval.current) {
                clearInterval(pingInterval.current);
            }
            if (wsRef.current) {
                wsRef.current.close(1000, 'Component unmounting');
            }
        };
    }, [connect]);

    return { isConnected, wsRef };
};

const styles = {
    app: {
        minHeight: '100vh',
        backgroundColor: config.theme.colors.background,
        color: config.theme.colors.text.primary,
        padding: config.theme.spacing.xl
    },
    container: {
        maxWidth: '1400px',
        margin: '0 auto'
    },
    title: {
        color: config.theme.colors.text.primary,
        marginBottom: config.theme.spacing.xl,
        textAlign: 'center'
    },
    searchSection: {
        backgroundColor: config.theme.colors.surface,
        padding: config.theme.spacing.lg,
        borderRadius: config.theme.radius.lg,
        marginBottom: config.theme.spacing.xl,
        border: `1px solid ${config.theme.colors.border}`
    },
    searchBar: {
        display: 'flex',
        gap: config.theme.spacing.md,
        marginBottom: config.theme.spacing.lg
    },
    input: {
        flex: 1,
        padding: config.theme.spacing.md,
        backgroundColor: config.theme.colors.background,
        border: `1px solid ${config.theme.colors.border}`,
        borderRadius: config.theme.radius.md,
        color: config.theme.colors.text.primary,
        fontSize: '16px'
    },
    button: {
        padding: `${config.theme.spacing.md} ${config.theme.spacing.lg}`,
        backgroundColor: config.theme.colors.primary,
        color: '#fff',
        border: 'none',
        borderRadius: config.theme.radius.md,
        cursor: 'pointer',
        fontSize: '16px',
        '&:hover': {
            opacity: 0.9
        }
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: config.theme.spacing.lg
    },
    filterBar: {
        display: 'flex',
        gap: config.theme.spacing.md,
        marginBottom: config.theme.spacing.lg,
        alignItems: 'center'
    },
    select: {
        padding: config.theme.spacing.md,
        backgroundColor: config.theme.colors.background,
        border: `1px solid ${config.theme.colors.border}`,
        borderRadius: config.theme.radius.md,
        color: config.theme.colors.text.primary,
        fontSize: '16px'
    },
    assetCard: {
        backgroundColor: config.theme.colors.surface,
        borderRadius: config.theme.radius.md,
        border: `1px solid ${config.theme.colors.border}`,
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
        paddingTop: '56.25%', // 16:9 aspect ratio
        backgroundColor: config.theme.colors.background,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderBottom: `1px solid ${config.theme.colors.border}`
    },
    cardContent: {
        padding: config.theme.spacing.lg
    },
    metadataGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: config.theme.spacing.sm,
        color: config.theme.colors.text.secondary,
        fontSize: '14px'
    },
    assetDetails: {
        padding: config.theme.spacing.xl
    },
    videoContainer: {
        marginBottom: config.theme.spacing.lg
    },
    header: {
        display: 'flex',
        flexDirection: 'column',
        gap: config.theme.spacing.md,
        marginBottom: config.theme.spacing.xl
    },
    logo: {
        fontSize: config.theme.fontSize.xl,
        color: config.theme.colors.text.primary,
        margin: 0
    }
};

// Utility functions for sorting and formatting
const normalizeResolution = (resolution) => {
    // Convert resolution to total pixels for comparison
    if (!resolution || !Array.isArray(resolution)) return 0;
    return resolution[0] * resolution[1];
};

const getFilteredAssets = (assets, searchQuery, fileTypeFilter, sortBy, sortDirection) => {
    return assets
        .filter(asset => 
            (!fileTypeFilter || fileTypeFilter === 'all' || asset.media_metadata?.file_type === fileTypeFilter) &&
            (!searchQuery.trim() || asset.title.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        .sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'title': 
                    comparison = a.title.localeCompare(b.title);
                    break;
                case 'duration': 
                    comparison = (a.media_metadata?.duration || 0) - (b.media_metadata?.duration || 0);
                    break;
                case 'size': 
                    // Compare file sizes numerically
                    const sizeA = parseFloat(a.media_metadata?.file_size) || 0;
                    const sizeB = parseFloat(b.media_metadata?.file_size) || 0;
                    comparison = sizeA - sizeB;
                    break;
                case 'fps': 
                    // Normalize FPS values for comparison
                    const fpsA = parseFloat(a.media_metadata?.fps) || 0;
                    const fpsB = parseFloat(b.media_metadata?.fps) || 0;
                    comparison = fpsA - fpsB;
                    break;
                case 'resolution':
                    // Compare total pixels for resolution
                    const resA = normalizeResolution(a.media_metadata?.resolution);
                    const resB = normalizeResolution(b.media_metadata?.resolution);
                    comparison = resA - resB;
                    break;
                default: 
                    comparison = 0;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
};

// Get available sort options from metadata
const getSortOptions = (assets) => {
    const options = new Set(['title']);
    
    assets.forEach(asset => {
        if (asset.media_metadata) {
            if (asset.media_metadata.duration) options.add('duration');
            if (asset.media_metadata.resolution) options.add('resolution');
            if (asset.media_metadata.fps) options.add('fps');
            if (asset.media_metadata.file_size) options.add('size');
        }
    });
    
    return Array.from(options);
};

// Separate MediaLibrary into its own component outside App
const MediaLibrary = ({ 
    assets,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
    viewMode,
    setViewMode,
    setShowDirectoryManager,
    filteredAssets
}) => {
    const navigate = useNavigate();
    const sortOptions = getSortOptions(assets);
    
    return (
        <div style={styles.container}>
            {/* Header with Logo and Scan Button */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: config.theme.spacing.lg
            }}>
                <h1 style={{
                    color: config.theme.colors.primary,
                    fontSize: config.theme.fontSize.xl,
                    fontWeight: config.theme.fontWeight.bold,
                    margin: 0
                }}>
                    valn.io
                </h1>
                
                <button
                    onClick={() => setShowDirectoryManager(true)}
                    style={{
                        padding: `${config.theme.spacing.sm} ${config.theme.spacing.md}`,
                        backgroundColor: config.theme.colors.primary,
                        color: '#fff',
                        border: 'none',
                        borderRadius: config.theme.radius.md,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: config.theme.spacing.sm,
                        fontSize: '0.9rem'
                    }}
                >
                    🔍 Scan Media
                </button>
            </Box>

            <div style={styles.searchSection}>
                <div style={styles.filterBar}>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search media assets..."
                        style={styles.input}
                    />
                    <select 
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        style={styles.select}
                    >
                        {sortOptions.map(option => (
                            <option key={option} value={option}>
                                Sort by: {option.charAt(0).toUpperCase() + option.slice(1)}
                            </option>
                        ))}
                    </select>
                    
                    {/* Sort Direction Buttons */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                            onClick={() => setSortDirection('asc')}
                            style={{
                                padding: config.theme.spacing.sm,
                                background: sortDirection === 'asc' ? config.theme.colors.primary : 'transparent',
                                border: `1px solid ${config.theme.colors.border}`,
                                borderRadius: config.theme.radius.sm,
                                cursor: 'pointer',
                                color: sortDirection === 'asc' ? '#fff' : config.theme.colors.text.primary,
                            }}
                        >
                            ↑ Asc
                        </button>
                        <button
                            onClick={() => setSortDirection('desc')}
                            style={{
                                padding: config.theme.spacing.sm,
                                background: sortDirection === 'desc' ? config.theme.colors.primary : 'transparent',
                                border: `1px solid ${config.theme.colors.border}`,
                                borderRadius: config.theme.radius.sm,
                                cursor: 'pointer',
                                color: sortDirection === 'desc' ? '#fff' : config.theme.colors.text.primary,
                            }}
                        >
                            ↓ Desc
                        </button>
                    </div>
                    <ViewToggle 
                        viewMode={viewMode} 
                        setViewMode={setViewMode} 
                    />
                </div>

                {error && (
                    <div style={{ 
                        color: config.theme.colors.error, 
                        marginBottom: config.theme.spacing.md 
                    }}>
                        {error}
                    </div>
                )}

                {viewMode === 'grid' ? (
                    <div style={styles.grid}>
                        {filteredAssets.map((asset) => (
                            <AssetCard 
                                key={asset.id} 
                                asset={asset}
                                onClick={() => navigate(`/asset/${asset.id}`, { state: { asset } })}
                            />
                        ))}
                    </div>
                ) : (
                    <ListView assets={filteredAssets} navigate={navigate} />
                )}

                {loading && (
                    <div style={{ textAlign: 'center', padding: config.theme.spacing.xl }}>
                        <CircularProgress />
                    </div>
                )}

                {!loading && filteredAssets.length === 0 && (
                    <div style={{ 
                        textAlign: 'center', 
                        padding: config.theme.spacing.xl,
                        color: config.theme.colors.text.secondary
                    }}>
                        {searchQuery.trim() ? 'No matching assets found' : 'No assets found'}
                    </div>
                )}
            </div>
        </div>
    );
};

function App() {
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState('grid');
    const [sortBy, setSortBy] = useState('title');
    const [sortDirection, setSortDirection] = useState('asc');
    const [showDirectoryManager, setShowDirectoryManager] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

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
                title: asset.title || 'Untitled',
                description: asset.description || '',
                media_metadata: {
                    ...asset.media_metadata,
                    duration: Number(asset.media_metadata?.duration) || 0,
                    fps: Number(asset.media_metadata?.fps) || 0,
                    file_size: Number(asset.media_metadata?.file_size) || 0
                }
            }));
            
            setAssets(validatedAssets);
            
            // Log success for debugging
            console.log(`Loaded ${validatedAssets.length} assets successfully`);
            
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

    // Now wsCallbacks can safely use loadAssets
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

    const { isConnected } = useWebSocket(wsCallbacks);

    // Memoized filtered assets
    const filteredAssets = useMemo(() => {
        if (!assets?.length) return [];
        
        const query = searchQuery.trim().toLowerCase();
        const filtered = query
            ? assets.filter(asset => {
                const title = (asset?.title || '').toLowerCase();
                const description = (asset?.description || '').toLowerCase();
                return title.includes(query) || description.includes(query);
              })
            : assets;

        return filtered.sort((a, b) => {
            const getValue = (item) => {
                switch (sortBy) {
                    case 'duration': return item?.media_metadata?.duration || 0;
                    case 'resolution': return item?.media_metadata?.resolution 
                        ? item.media_metadata.resolution[0] * item.media_metadata.resolution[1] 
                        : 0;
                    case 'fps': return item?.media_metadata?.fps || 0;
                    case 'size': return item?.media_metadata?.file_size || 0;
                    default: return item?.title || '';
                }
            };

            const aVal = getValue(a);
            const bVal = getValue(b);
            
            const comparison = typeof aVal === 'string' 
                ? aVal.localeCompare(bVal)
                : aVal - bVal;
                
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [assets, searchQuery, sortBy, sortDirection]);

    // Load assets on mount
    useEffect(() => {
        loadAssets();
    }, [loadAssets]);

    // Callback for when scan is complete
    const handleScanComplete = useCallback(() => {
        loadAssets();
        setShowDirectoryManager(false);
    }, [loadAssets]);

    return (
        <ThemeProvider theme={theme}>
            <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                minHeight: '100vh',
                bgcolor: config.theme.colors.background
            }}>
                <SystemHealth />
                
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
                                filteredAssets={filteredAssets}
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

// Example component for rendering a thumbnail
const Thumbnail = ({ url, alt }) => (
    <div style={{ width: '100%', height: 'auto' }}>
        <img 
            src={url} 
            alt={alt} 
            style={{ width: '100%', height: 'auto' }} 
            onError={(e) => e.target.src = 'path/to/placeholder.png'} // Fallback image
        />
    </div>
);

export default App;
