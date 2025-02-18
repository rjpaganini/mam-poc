/**
 * @file: App.js
 * @description: Main application component for the Media Asset Management (MAM) system
 * @version: 1.0.2
 * @lastModified: February 13, 2025
 * 
 * Core Responsibilities:
 * - Application routing and navigation
 * - Theme management and configuration
 * - WebSocket connection handling for real-time updates
 * - Global state management
 * - System health monitoring
 * - Asset processing status tracking
 * - AWS integration and metrics visualization
 * 
 * Key Features:
 * - Real-time asset updates via WebSocket (port 5001)
 * - Dynamic theme switching with MUI v5
 * - Responsive layout management
 * - Error boundary implementation
 * - Performance optimization with React hooks
 * - AWS service metrics and monitoring
 * - Intelligent media scanning and processing
 * 
 * Component Structure:
 * - App (main)
 *   ├── Header
 *   │   └── NavigationMenu
 *   ├── MediaLibrary
 *   │   ├── ListView
 *   │   ├── GridView
 *   │   └── ViewToggle
 *   ├── SystemHealth
 *   │   └── HealthIndicators
 *   ├── MetricsDashboard
 *   │   ├── ServiceUsage
 *   │   ├── CostBreakdown
 *   │   └── PerformanceGraphs
 *   ├── DirectoryManager
 *   │   └── ScanProgress
 *   ├── AssetDetails
 *   │   ├── MetadataPanel
 *   │   └── ProcessingStatus
 *   └── ProcessingStatus
 *       └── ProgressIndicator
 * 
 * WebSocket Events:
 * - 'asset_update': Real-time asset metadata updates
 * - 'processing_status': Processing pipeline status
 * - 'health_update': System health status changes
 * - 'metrics_update': AWS service metrics updates
 * 
 * State Management:
 * - assets: Media asset collection
 * - processing: Current processing status
 * - health: System health status
 * - metrics: AWS service metrics
 * - ui: View modes and filters
 * 
 * @see docs/ARCHITECTURE.md for detailed system design
 * @see docs/API.md for WebSocket protocol details
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { BrowserRouter as Router } from 'react-router-dom';
import { FaTimesCircle, FaCheckCircle } from 'react-icons/fa';
import theme from './theme/theme';
import MediaLibrary from './components/MediaLibrary';
import ProcessingStatus from './components/ProcessingStatus';
import { useWebSocketService } from './hooks/useWebSocketService';
import logger from './services/logger';
import { Routes, Route } from 'react-router-dom';
import { Box as MuiBox, CssBaseline } from '@mui/material';
import { ViewToggle } from './components/MediaLibrary/ViewToggle';
import config from './config';
import { assetsApi } from './services/api';
import SystemHealth from './components/SystemHealth';
import DirectoryManager from './components/DirectoryManager';
import AssetDetails from './components/AssetDetails';
import Header from './components/Header';
import { FaCog, FaSearch, FaDatabase } from 'react-icons/fa';
import MetricsDashboard from './components/MetricsDashboard';

// Updated styles using MUI theme spacing
const styles = theme => ({
    app: {
        minHeight: '100vh',
        backgroundColor: theme.palette.background.default,
        color: theme.palette.text.primary
    },
    container: {
        maxWidth: '1400px',
        margin: '0 auto'
    },
    title: {
        color: theme.palette.text.primary,
        textAlign: 'center'
    },
    searchSection: {
        backgroundColor: theme.palette.background.paper,
        borderRadius: theme.shape.borderRadius,
        border: `1px solid ${theme.palette.divider}`,
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
        backgroundColor: theme.palette.background.default,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: theme.shape.borderRadius,
        color: theme.palette.text.primary,
        fontSize: '16px'
    },
    button: {
        backgroundColor: theme.palette.primary.main,
        color: '#fff',
        border: 'none',
        borderRadius: theme.shape.borderRadius,
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
        backgroundColor: theme.palette.background.default,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: theme.shape.borderRadius,
        color: theme.palette.text.primary,
        fontSize: '16px'
    },
    assetCard: {
        backgroundColor: theme.palette.background.paper,
        borderRadius: theme.shape.borderRadius,
        border: `1px solid ${theme.palette.divider}`,
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
        backgroundColor: theme.palette.background.default,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderBottom: `1px solid ${theme.palette.divider}`
    },
    cardContent: {
        padding: 3 // MUI spacing unit
    },
    metadataGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 1, // MUI spacing unit
        color: theme.palette.text.secondary,
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
        fontSize: theme.typography.fontSize.xl,
        color: theme.palette.text.primary,
        margin: 0
    }
});

// WebSocket callbacks for app-level events
const wsCallbacks = {
    onMessage: (message) => {
        logger.debug('App received WebSocket message:', message);
    },
    onError: (error) => {
        logger.error('App WebSocket error:', error);
    },
    onConnectionChange: (connected) => {
        logger.info('App WebSocket connection state:', connected);
    }
};

/**
 * Main App component
 * Provides theme context and routing
 */
const App = () => {
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState('grid');
    const [sortBy, setSortBy] = useState('title');
    const [sortDirection, setSortDirection] = useState('asc');
    const [showDirectoryManager, setShowDirectoryManager] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTags, setSelectedTags] = useState([]);
    const [scanFeedback, setScanFeedback] = useState(null);
    const [scanProgress, setScanProgress] = useState({
        stage: null, // 'searching', 'extracting', 'processing', 'complete'
        total: 0,
        current: 0,
        details: '',
        foundFiles: []
    });

    const { isConnected } = useWebSocketService(wsCallbacks);

    // Memoize loadAssets to prevent unnecessary re-renders
    const loadAssets = useCallback(async (retryCount = 0) => {
        try {
            setLoading(true);
            setError(null); // Clear previous errors
            
            const assets = await assetsApi.getAssets();
            
            // Validate response data
            if (!Array.isArray(assets)) {
                throw new Error('Invalid response format: expected array');
            }
            
            // Validate and transform assets
            const validatedAssets = assets.filter(asset => {
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
                duration: Number(asset.duration) || 0,
                fps: Number(asset.fps) || 0,
                width: Number(asset.width) || 0,
                height: Number(asset.height) || 0,
                codec: asset.codec || '',
                container_format: asset.container_format || '',
                bit_rate: Number(asset.bit_rate) || 0,
                audio_codec: asset.audio_codec || '',
                audio_channels: Number(asset.audio_channels) || 0,
                audio_sample_rate: Number(asset.audio_sample_rate) || 0
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
            
            setError('Failed to load assets. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    // Load assets on mount
    useEffect(() => {
        loadAssets();
    }, [loadAssets]);

    // Callback for when scan is complete
    const handleScanComplete = () => {
        loadAssets();
        setShowDirectoryManager(false);
    };

    // Handle scanning media with progress
    const handleScan = async () => {
        try {
            // Initialize scanning state
            setScanProgress({
                stage: 'searching',
                total: 0,
                current: 0,
                details: 'Searching for media files...',
                foundFiles: []
            });
            
            const response = await fetch(`${config.api.baseURL}/scan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) throw new Error(`Scan failed: ${response.statusText}`);
            
            // Set up SSE for progress updates
            const data = await response.json();
            
            if (data.assets && data.assets.length > 0) {
                setScanProgress(prev => ({
                    ...prev,
                    stage: 'complete',
                    total: data.assets.length,
                    current: data.assets.length,
                    details: `Found ${data.assets.length} new files`,
                    foundFiles: data.assets
                }));
                
                setScanFeedback({
                    type: 'success',
                    message: `Found ${data.assets.length} new files!`,
                    details: data.message
                });
            } else {
                setScanProgress(prev => ({
                    ...prev,
                    stage: 'complete',
                    details: 'No new files found'
                }));
                
                setScanFeedback({
                    type: 'info',
                    message: 'No new files found. Media library is up to date.'
                });
            }
            
            await loadAssets();
            
        } catch (error) {
            console.error('Scan failed:', error);
            setScanProgress(prev => ({
                ...prev,
                stage: 'error',
                details: error.message
            }));
            setScanFeedback({
                type: 'error',
                message: `Scan failed: ${error.message}`
            });
        } finally {
            setLoading(false);
            // Clear feedback after 5 seconds
            setTimeout(() => {
                setScanFeedback(null);
                setScanProgress({ stage: null, total: 0, current: 0, details: '', foundFiles: [] });
            }, 5000);
        }
    };

    // Progress indicator component
    const ScanProgressIndicator = () => {
        if (!scanProgress.stage) return null;

        const stages = {
            searching: {
                icon: FaSearch,
                color: theme.palette.info.main,
                label: 'Searching Media Files',
                description: 'Scanning your media directory for any new files...'
            },
            extracting: {
                icon: FaDatabase,
                color: theme.palette.warning.main,
                label: 'Extracting Metadata',
                description: 'Reading file information and metadata...'
            },
            processing: {
                icon: FaCog,
                color: theme.palette.success.main,
                label: 'Processing',
                description: 'Processing media files...'
            },
            complete: {
                icon: FaCheckCircle,
                color: theme.palette.success.main,
                label: 'Scan Complete',
                description: 'Media library scan completed successfully.'
            },
            error: {
                icon: FaTimesCircle,
                color: theme.palette.error.main,
                label: 'Error',
                description: 'An error occurred during the scan.'
            }
        };

        const currentStage = stages[scanProgress.stage];
        const Icon = currentStage.icon;

        // Handle click outside
        const handleClickOutside = (event) => {
            // Check if click is outside the progress box
            if (event.target.getAttribute('data-overlay') === 'true') {
                setScanProgress({ stage: null });
            }
        };

        // Handle close button click
        const handleClose = (event) => {
            event.stopPropagation(); // Prevent event from bubbling
            setScanProgress({ stage: null });
        };

        return (
            <MuiBox
                onClick={handleClickOutside}
                data-overlay="true"
                sx={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'transparent',
                    zIndex: 9998
                }}
            >
                <MuiBox
                    onClick={(e) => e.stopPropagation()} // Prevent clicks on content from closing
                    sx={{
                        position: 'fixed',
                        top: '16px',  // Position near top
                        right: '16px', // Position on right side
                        maxWidth: '300px', // Reduced width
                        zIndex: 9999,
                        p: 2, // Reduced padding
                        borderRadius: 1,
                        backgroundColor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        boxShadow: 3,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1 // Reduced gap
                    }}
                >
                    {/* Header */}
                    <MuiBox sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1,
                        color: currentStage.color,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        pb: 1 // Reduced padding
                    }}>
                        <Icon size={16} /> {/* Reduced icon size */}
                        <Typography sx={{ 
                            fontWeight: 'medium',
                            fontSize: '0.7rem' // Smaller font
                        }}>
                            {currentStage.label}
                        </Typography>
                        {scanProgress.stage !== 'complete' && scanProgress.stage !== 'error' && (
                            <CircularProgress 
                                size={14} 
                                sx={{ 
                                    color: currentStage.color,
                                    ml: 'auto',
                                    mr: 1
                                }} 
                            />
                        )}
                        {/* Close button */}
                        <MuiBox
                            onClick={handleClose}
                            sx={{
                                ml: 'auto',
                                cursor: 'pointer',
                                color: 'text.secondary',
                                fontSize: '1rem',
                                lineHeight: 1,
                                display: 'flex',
                                alignItems: 'center',
                                padding: '4px',
                                borderRadius: '4px',
                                '&:hover': {
                                    color: 'text.primary',
                                    backgroundColor: 'action.hover'
                                }
                            }}
                        >
                            ×
                        </MuiBox>
                    </MuiBox>

                    {/* Description */}
                    <Typography sx={{ 
                        color: 'text.primary',
                        fontSize: '0.7rem' // Smaller font
                    }}>
                        {currentStage.description}
                    </Typography>

                    {/* Details */}
                    <Typography sx={{ 
                        color: 'text.secondary',
                        fontSize: '0.7rem', // Smaller font
                        fontWeight: 'medium'
                    }}>
                        {scanProgress.details}
                    </Typography>

                    {/* Progress for found files */}
                    {scanProgress.stage === 'complete' && (
                        <MuiBox sx={{ mt: 0.5 }}>
                            {scanProgress.foundFiles.length > 0 ? (
                                <>
                                    <Typography sx={{ 
                                        color: 'success.main', 
                                        display: 'block',
                                        fontSize: '0.7rem',
                                        fontWeight: 'medium',
                                        mb: 0.5
                                    }}>
                                        Found {scanProgress.foundFiles.length} new files:
                                    </Typography>
                                    <MuiBox sx={{ 
                                        maxHeight: '100px', // Reduced height
                                        overflowY: 'auto',
                                        fontSize: '0.7rem',
                                        color: 'text.secondary',
                                        bgcolor: 'background.default',
                                        p: 1,
                                        borderRadius: 1
                                    }}>
                                        {scanProgress.foundFiles.map((file, index) => (
                                            <Typography 
                                                key={index} 
                                                sx={{ 
                                                    py: 0.25,
                                                    textOverflow: 'ellipsis',
                                                    overflow: 'hidden',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                {file.title}
                                            </Typography>
                                        ))}
                                    </MuiBox>
                                </>
                            ) : (
                                <Typography sx={{ 
                                    color: 'info.main', 
                                    fontSize: '0.7rem',
                                    fontWeight: 'medium'
                                }}>
                                    No new files found. Your media library is up to date!
                                </Typography>
                            )}
                        </MuiBox>
                    )}
                </MuiBox>
            </MuiBox>
        );
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {/* Application Root - Stacking Context Management
                Creates a new stacking context hierarchy:
                1. Draggable Title Bar (z-index: 2)
                2. Sticky Header (z-index: 3)
                3. Main Content (z-index: 1)
            */}
            <MuiBox sx={{ 
                minHeight: '100vh',
                backgroundColor: 'background.default',
                color: 'text.primary',
                position: 'relative',
                isolation: 'isolate'  // Creates new stacking context for proper z-index handling
            }}>
                {/* Draggable Title Bar - System Integration Layer
                    - Positioned above content but below header
                    - Handles window dragging without interfering with header interactions
                */}
                <MuiBox sx={{ 
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '38px',
                    WebkitAppRegion: 'drag',
                    WebkitUserSelect: 'none',
                    bgcolor: 'transparent',
                    zIndex: 2  // Sits between content and header
                }} />
                
                {/* Sticky Header - Interactive Controls Layer
                    - Highest interactive layer (z-index: 3)
                    - Creates isolated stacking context for header elements
                    - Maintains clickability during scroll
                */}
                <MuiBox sx={{
                    position: 'sticky',
                    top: 0,
                    left: 0,
                    right: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    px: 3,
                    py: 2,
                    mt: '38px',
                    bgcolor: 'background.default',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    zIndex: 3,
                    isolation: 'isolate'
                }}>
                    {/* Logo */}
                    <MuiBox sx={{ 
                        position: 'absolute',
                        left: '25%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        WebkitAppRegion: 'no-drag',
                        pointerEvents: 'auto'  // Ensure logo is clickable
                    }}>
                        <MuiBox component="h1" sx={{
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
                        </MuiBox>
                    </MuiBox>

                    {/* Layout spacer */}
                    <MuiBox sx={{ width: '100px' }} />

                    {/* Controls */}
                    <MuiBox sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 2,
                        WebkitAppRegion: 'no-drag',
                        position: 'relative',
                        pointerEvents: 'auto'  // Ensure controls are clickable
                    }}>
                        {/* AI Processing Stats - Compact Display */}
                        <MuiBox sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            px: 2,
                            py: 0.5,
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider',
                            fontSize: '0.7rem'
                        }}>
                            <MuiBox sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <MuiBox component="span" color="text.secondary">AI:</MuiBox>
                                <MuiBox component="span" color="success.main">
                                    {assets.filter(a => a?.media_metadata?.ai_metadata?.processed_at).length}
                                </MuiBox>
                                <MuiBox component="span" color="text.secondary">/</MuiBox>
                                <MuiBox component="span">
                                    {assets.length}
                                </MuiBox>
                            </MuiBox>
                        </MuiBox>

                        {/* Scan Media Button */}
                        <MuiBox
                            component="button"
                            onClick={handleScan}
                            sx={{
                                px: 1.5,
                                py: 0.5,
                                height: '24px',
                                bgcolor: 'common.black',
                                color: 'common.white',
                                border: '1px solid',
                                borderColor: 'primary.main',
                                borderRadius: 1,
                                cursor: 'pointer',
                                fontSize: '0.7rem',
                                fontWeight: 'medium',
                                transition: 'all 0.2s ease',
                                WebkitAppRegion: 'no-drag',
                                position: 'relative',
                                zIndex: 2,  // Local z-index within header
                                fontFamily: theme => theme.typography.fontFamily,
                                textTransform: 'none',
                                '&:hover': {
                                    bgcolor: 'primary.main',
                                    color: 'common.white',
                                    transform: 'translateY(-1px)'
                                },
                                '&:focus': {
                                    bgcolor: 'primary.main',
                                    color: 'common.white',
                                    outline: 'none'
                                },
                                '&:active': {
                                    transform: 'translateY(0)'
                                }
                            }}
                        >
                            Scan Media
                        </MuiBox>

                        <SystemHealth 
                            wsConnected={isConnected} 
                        />
                    </MuiBox>
                </MuiBox>

                {/* Main content */}
                <MuiBox sx={{ 
                    flex: 1, 
                    p: 2,
                    position: 'relative',
                    zIndex: 1  // Ensure main content stays below header
                }}>
                    <Routes>
                        <Route path="/" element={
                            loading ? (
                                <MuiBox sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                                    <CircularProgress />
                                </MuiBox>
                            ) : error ? (
                                <Typography color="error" sx={{ textAlign: 'center', mt: 4 }}>
                                    {error}
                                </Typography>
                            ) : (
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
                            )
                        } />
                        <Route path="/asset/:id" element={<AssetDetails />} />
                        <Route path="/metrics" element={<MetricsDashboard />} />
                    </Routes>
                </MuiBox>

                {/* Processing Status for real-time updates */}
                <ProcessingStatus />

                {showDirectoryManager && (
                    <DirectoryManagerModal 
                        onClose={() => setShowDirectoryManager(false)}
                        onScanComplete={handleScanComplete}
                    />
                )}

                {/* Status indicator */}
                {!isConnected && (
                    <Typography 
                        color="error" 
                        sx={{ 
                            position: 'fixed', 
                            top: 16, 
                            right: 16,
                            bgcolor: 'background.paper',
                            p: 1,
                            borderRadius: 1
                        }}
                    >
                        Disconnected
                    </Typography>
                )}

                {/* Replace the old feedback message with the new progress indicator */}
                <ScanProgressIndicator />
            </MuiBox>
        </ThemeProvider>
    );
};

// Separate modal component for better organization
const DirectoryManagerModal = ({ onClose, onScanComplete }) => (
    <MuiBox sx={{
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
        <MuiBox sx={{
            backgroundColor: theme.palette.background.paper,
            borderRadius: theme.shape.borderRadius,
            padding: 3,
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
        }}>
            <MuiBox sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2
            }}>
                <h2 style={{ margin: 0, color: theme.palette.text.primary }}>
                    Media Directories
                </h2>
                <button
                    onClick={onClose}
                    style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: theme.palette.text.secondary,
                        cursor: 'pointer',
                        padding: theme.spacing.sm
                    }}
                >
                    ✕
                </button>
            </MuiBox>
            <DirectoryManager onScanComplete={onScanComplete} />
        </MuiBox>
    </MuiBox>
);

export default App;
