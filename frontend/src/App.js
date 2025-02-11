/**
 * @file: App.js
 * @description: Main application component for the Media Asset Management (MAM) system
 * 
 * Core Responsibilities:
 * - Application routing and navigation
 * - Theme management and configuration
 * - WebSocket connection handling for real-time updates
 * - Global state management
 * - System health monitoring
 * - Asset processing status tracking
 * 
 * Key Features:
 * - Real-time asset updates via WebSocket
 * - Dynamic theme switching
 * - Responsive layout management
 * - Error boundary implementation
 * - Performance optimization with React hooks
 * 
 * Component Structure:
 * - App (main)
 *   ├── MediaLibrary
 *   │   ├── ListView
 *   │   ├── GridView
 *   │   └── ViewToggle
 *   ├── SystemHealth
 *   ├── DirectoryManager
 *   ├── AssetDetails
 *   └── ProcessingStatus
 * 
 * @author: AI Assistant
 * @lastModified: February 2024
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { BrowserRouter as Router } from 'react-router-dom';
import theme from './theme';
import MediaLibrary from './components/MediaLibrary';
import ProcessingStatus from './components/ProcessingStatus';
import { useWebSocketService } from './hooks/useWebSocketService';
import logger from './services/logger';
import { Routes, Route } from 'react-router-dom';
import { Box as MuiBox, CircularProgress, CssBaseline } from '@mui/material';
import { ViewToggle } from './components/MediaLibrary/ViewToggle';
import config from './config';
import { assetsApi } from './services/api';
import SystemHealth from './components/SystemHealth';
import DirectoryManager from './components/DirectoryManager';
import AssetDetails from './components/AssetDetails';

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

    const { isConnected } = useWebSocketService(wsCallbacks);

    // Memoize loadAssets to prevent unnecessary re-renders
    const loadAssets = useCallback(async (retryCount = 0) => {
        try {
            setLoading(true);
            setError(null); // Clear previous errors
            
            const response = await assetsApi.getAssets();
            
            // Validate response data
            if (!Array.isArray(response)) {
                throw new Error('Invalid response format: expected array');
            }
            
            // Validate and transform assets
            const validatedAssets = response.filter(asset => {
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

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <MuiBox sx={{ 
                minHeight: '100vh',
                bgcolor: 'background.default',
                color: 'text.primary'
            }}>
                {/* Draggable title bar */}
                <MuiBox sx={{ 
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
                <MuiBox sx={{
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
                    <MuiBox sx={{ 
                        position: 'absolute',
                        left: '25%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        WebkitAppRegion: 'no-drag',
                        zIndex: 1
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
                        zIndex: 2
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
                        </MuiBox>

                        <SystemHealth 
                            wsConnected={isConnected} 
                        />
                    </MuiBox>
                </MuiBox>

                {/* Main content */}
                <MuiBox sx={{ flex: 1, p: 2 }}>
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
