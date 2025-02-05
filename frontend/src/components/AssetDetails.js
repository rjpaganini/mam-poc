/**
 * @file: AssetDetails.js
 * @type: Component (Route-Level)
 * @description: Detailed view component for individual media assets.
 * 
 * This component provides a comprehensive view of a single media asset, including:
 * - Video playback with controls
 * - Technical metadata display (resolution, codec, bitrate, etc.)
 * - File information and location
 * - Navigation controls
 * 
 * Layout Structure:
 * ┌─────────────────────────────────────────────────┐
 * │ Back Button         Asset Title                 │
 * ├───────────────────────┬─────────────────────────┤
 * │                       │                         │
 * │                       │     Metadata Panel      │
 * │    Video Panel       │     - File Size         │
 * │                       │     - Resolution        │
 * │                       │     - Duration          │
 * │                       │     - Frame Rate        │
 * │                       │     - Codec            │
 * │                       │     - Format           │
 * │                       │                         │
 * │                       │     [File Path]         │
 * └───────────────────────┴─────────────────────────┘
 * 
 * @hierarchy
 * App
 * └─ AssetDetails (this file)
 *    ├─ Video Player
 *    └─ Metadata Panel
 * 
 * @dependencies
 * - @mui/material: UI components and styling
 * - react-router-dom: Navigation and routing
 * - fileUtils: File system operations
 * - formatters: Data formatting utilities
 * 
 * @features
 * - Responsive video playback
 * - Real-time metadata display
 * - File system integration
 * - Error boundary protection
 * - Keyboard navigation support
 */

import React, { useState, useEffect } from 'react';
import { Box, Paper, CircularProgress } from '@mui/material';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import config from '../config';
import { openFolder } from '../utils/fileUtils';
import logger from '../services/logger';
import { assetsApi } from '../services/api';
import { formatFileSize } from '../utils/formatters';

// Error boundary for asset details
class AssetDetailsErrorBoundary extends React.Component {
    state = { hasError: false, error: null };

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        logger.error('AssetDetails render failed', error, {
            component: 'AssetDetails',
            errorInfo,
            path: window.location.pathname
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <Box sx={{
                    p: 3,
                    bgcolor: config.theme.colors.surface,
                    borderRadius: config.theme.radius.lg,
                    color: config.theme.colors.error
                }}>
                    <h2>Something went wrong</h2>
                    <p>Failed to display asset details. Please try refreshing the page.</p>
                </Box>
            );
        }
        return this.props.children;
    }
}

/**
 * AssetDetails component for displaying detailed media information
 * Ensures consistent dark theme throughout with proper background coverage
 */
const AssetDetails = () => {
    const { id } = useParams();
    const { state } = useLocation();
    const navigate = useNavigate();
    const [asset, setAsset] = useState(state?.asset);
    const [videoError, setVideoError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showPath, setShowPath] = useState(false);
    const [copied, setCopied] = useState(false);

    // Add keyboard shortcut for navigation
    useEffect(() => {
        const handleKeyPress = (e) => {
            // Navigate back on Esc or Cmd/Ctrl + Left Arrow
            if (e.key === 'Escape' || (e.key === 'ArrowLeft' && (e.metaKey || e.ctrlKey))) {
                navigate('/');
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [navigate]);

    // Fetch asset data
    useEffect(() => {
        const fetchAsset = async () => {
            try {
                setIsLoading(true);
                // Try to fetch the specific asset first
                const response = await fetch(`${config.api.baseURL}/api/v1/assets/${id}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setAsset(data);
                logger.info('Asset details loaded', {
                    assetId: data.id,
                    title: data.title
                });
            } catch (error) {
                logger.error('Failed to fetch asset data', {
                    error,
                    assetId: id
                });
                // Fallback to using the passed state if available
                if (!asset && state?.asset) {
                    setAsset(state.asset);
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchAsset();
    }, [id, state?.asset]);

    useEffect(() => {
        if (!asset) {
            logger.warn('Asset details accessed without asset data', {
                path: window.location.pathname,
                state,
                timestamp: new Date().toISOString()
            });
        } else {
            logger.info('Asset details viewed', {
                assetId: asset.id,
                title: asset.title,
                state
            });
        }
    }, [asset, state]);

    // Handle opening folder in Finder
    const handleOpenFolder = async () => {
        if (asset?.file_path) {
            try {
                await openFolder(asset.file_path);
                logger.info('Folder opened successfully', {
                    assetId: asset.id,
                    path: asset.file_path
                });
            } catch (error) {
                logger.error('Failed to open folder', error, {
                    assetId: asset.id,
                    path: asset.file_path
                });
            }
        }
    };

    // Handle video loading events
    const handleVideoLoad = () => {
        setIsLoading(false);
        logger.info('Video loaded in details view', {
            assetId: asset.id,
            title: asset.title
        });
    };

    const handleVideoError = (event) => {
        const error = event.target.error;
        setVideoError(error);
        setIsLoading(false);
        logger.error('Video playback error', error, {
            assetId: asset.id,
            mediaError: {
                code: error.code,
                message: error.message
            }
        });
    };

    // Handle copy to clipboard with visual feedback
    const handleCopy = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            // Reset copy feedback after 2 seconds
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            logger.error('Failed to copy to clipboard:', err);
        }
    };

    // Format metadata values for display with error handling
    const formatMetadataValue = (key, value) => {
        try {
            // Handle file size (stored in bytes at root level)
            if (key === 'file_size') {
                return formatFileSize(value);
            }

            // Handle objects (like audio info)
            if (typeof value === 'object' && value !== null) {
                if ('channels' in value && 'codec' in value) {
                    // Format audio info
                    return `${value.codec} (${value.channels}ch, ${value.sample_rate}Hz)`;
                }
                return '-';
            }

            // Handle specific metadata types
            switch (key) {
                case 'duration':
                    // Format as timecode (00:00:00)
                    const totalSeconds = Math.round(value);
                    const hours = Math.floor(totalSeconds / 3600);
                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                    const seconds = totalSeconds % 60;
                    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                case 'fps':
                    return `${Number(value).toFixed(2)}`;
                case 'bitrate':
                    // Convert to Mbps with proper formatting
                    const mbps = value / 1000000; // Convert to Mbps
                    if (mbps >= 1) {
                        return `${mbps.toFixed(1)} Mbps`;
                    } else {
                        // For bitrates less than 1 Mbps, show in Kbps
                        const kbps = value / 1000;
                        return `${kbps.toFixed(0)} Kbps`;
                    }
                case 'width':
                case 'height':
                    // These will be combined into resolution
                    return value.toString();
                default:
                    return value?.toString() || '-';
            }
        } catch (error) {
            logger.error('Metadata formatting error', error, {
                key,
                value,
                assetId: asset?.id
            });
            return '-';
        }
    };

    // Filter and transform metadata for display
    const getDisplayMetadata = (asset) => {
        if (!asset || !asset.media_metadata) return [];
        
        const metadata = asset.media_metadata;
        const displayItems = [];
        
        // 1. File Size (use root level file_size)
        if (asset.file_size) {
            displayItems.push({
                label: 'File Size',
                value: formatMetadataValue('file_size', asset.file_size)
            });
        }
        
        // 2. Resolution (combine width and height)
        if (metadata.width && metadata.height) {
            displayItems.push({
                label: 'Resolution',
                value: `${metadata.width}×${metadata.height}`
            });
        }
        
        // 3. Duration
        if (metadata.duration) {
            displayItems.push({
                label: 'Duration',
                value: formatMetadataValue('duration', metadata.duration)
            });
        }
        
        // 4. Frame Rate
        if (metadata.fps) {
            displayItems.push({
                label: 'Frame Rate',
                value: formatMetadataValue('fps', metadata.fps)
            });
        }
        
        // 5. Video Codec (separated from container format)
        if (metadata.codec) {
            displayItems.push({
                label: 'Codec',
                value: metadata.codec.toUpperCase()
            });
        }

        // 6. Container Format (file extension)
        if (asset.file_path) {
            displayItems.push({
                label: 'Format',
                value: asset.file_path.split('.').pop().toUpperCase()
            });
        }
        
        // 7. Video Bitrate
        if (metadata.bitrate) {
            displayItems.push({
                label: 'Bitrate',
                value: formatMetadataValue('bitrate', metadata.bitrate)
            });
        }
        
        // 8. Audio Information
        if (metadata.audio) {
            displayItems.push({
                label: 'Audio',
                value: formatMetadataValue('audio', metadata.audio)
            });
        }
        
        return displayItems;
    };

    // Update file path formatting to only show from vallin_io onwards
    const formatFilePath = (path) => {
        if (!path) return '';
        const vallinIndex = path.indexOf('vallin_io');
        return vallinIndex !== -1 ? `.../${path.substring(vallinIndex)}` : path;
    };

    // Base container style to ensure dark theme coverage and proper spacing
    const containerStyle = {
        position: 'fixed',
        top: '64px', // Increased from 48px for more breathing room
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: config.theme.colors.background,
        overflow: 'auto',
        padding: config.theme.spacing.lg
    };

    // Update video URL construction
    const getVideoUrl = (filePath) => {
        const filename = filePath.split('/').pop();
        return `${config.api.mediaURL}/${encodeURIComponent(filename)}`;
    };

    // Show loading state
    if (isLoading) {
        return (
            <Box sx={containerStyle}>
                <Box sx={{ 
                    maxWidth: '1200px', 
                    margin: '0 auto',
                    padding: 2,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%'
                }}>
                    <CircularProgress />
                </Box>
            </Box>
        );
    }

    // Show error state if no asset found
    if (!asset) {
        return (
            <Box sx={containerStyle}>
                <Box sx={{ 
                    maxWidth: '1200px', 
                    margin: '0 auto',
                    padding: 2
                }}>
                    <button 
                        onClick={() => navigate('/')}
                        style={{
                            padding: `${config.theme.spacing.sm} ${config.theme.spacing.md}`,
                            backgroundColor: 'transparent',
                            color: config.theme.colors.text.primary,
                            border: `1px solid ${config.theme.colors.border}`,
                            borderRadius: config.theme.radius.md,
                            cursor: 'pointer',
                            marginBottom: config.theme.spacing.md
                        }}
                    >
                        ← Back to Library
                    </button>
                    <Box sx={{ 
                        color: config.theme.colors.error,
                        textAlign: 'center',
                        mt: 4
                    }}>
                        Asset not found
                    </Box>
                </Box>
            </Box>
        );
    }

    return (
        <AssetDetailsErrorBoundary>
            <Box sx={containerStyle}>
                {/* Main container with increased max width to accommodate side-by-side layout */}
                <Box sx={{ 
                    maxWidth: '1400px', // Increased to accommodate side-by-side layout
                    margin: '0 auto',
                    padding: 2
                }}>
                    {/* Header Section */}
                    <Box sx={{ 
                        display: 'flex',
                        alignItems: 'center',
                        mb: 2,
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                        backgroundColor: config.theme.colors.background
                    }}>
                        <button 
                            onClick={() => navigate('/')}
                            style={{
                                padding: '4px 8px',
                                backgroundColor: 'transparent',
                                color: config.theme.colors.text.primary,
                                border: `1px solid ${config.theme.colors.border}`,
                                borderRadius: config.theme.radius.sm,
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                            }}
                        >
                            ←
                        </button>
                        <h1 style={{ 
                            margin: 0,
                            marginLeft: config.theme.spacing.md,
                            color: config.theme.colors.text.primary,
                            fontSize: '1.2rem',
                            fontWeight: 500
                        }}>
                            {asset.title}
                        </h1>
                    </Box>

                    {/* Content Container - Side by Side Layout */}
                    <Box sx={{
                        display: 'flex',
                        gap: 2, // Reduced gap between panels
                        alignItems: 'stretch'
                    }}>
                        {/* Video Player Container */}
                        <Box sx={{
                            flex: '1 1 85%', // Increased to 85% as metadata panel reduces
                            backgroundColor: config.theme.colors.surface,
                            borderRadius: config.theme.radius.lg,
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            {videoError ? (
                                <Box sx={{
                                    p: 3,
                                    color: config.theme.colors.error,
                                    textAlign: 'center'
                                }}>
                                    Failed to load video
                                </Box>
                            ) : (
                                <video
                                    controls
                                    style={{
                                        width: '100%',
                                        height: 'auto',
                                        maxHeight: '70vh', // Reduced from 80vh
                                        backgroundColor: '#000'
                                    }}
                                    onLoadedData={handleVideoLoad}
                                    onError={handleVideoError}
                                    src={getVideoUrl(asset.file_path)}
                                />
                            )}
                        </Box>

                        {/* Metadata Panel - Reduced width */}
                        <Box sx={{
                            flex: '0 0 15%', // Reduced to 15% fixed width
                            minWidth: '180px', // Ensure minimum readable width
                            backgroundColor: config.theme.colors.surface,
                            borderRadius: config.theme.radius.lg,
                            p: 2, // Reduced padding
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between'
                        }}>
                            {/* Metadata List */}
                            <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1.5, // Slightly reduced gap
                                overflow: 'auto',
                                flex: '1 1 auto'
                            }}>
                                {getDisplayMetadata(asset).map((item, index) => (
                                    <Box key={index} sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 0.25 // Reduced gap
                                    }}>
                                        <Box sx={{
                                            fontSize: '0.7rem', // Further reduced
                                            color: config.theme.colors.text.secondary,
                                            fontWeight: 500 // Added for better readability
                                        }}>
                                            {item.label}
                                        </Box>
                                        <Box sx={{
                                            fontSize: '0.75rem', // Further reduced
                                            color: config.theme.colors.text.primary,
                                            fontWeight: 400
                                        }}>
                                            {item.value}
                                        </Box>
                                    </Box>
                                ))}
                            </Box>

                            {/* Compact File Location Section with Tooltip */}
                            <Box sx={{
                                mt: 1.5,
                                pt: 1.5,
                                borderTop: `1px solid ${config.theme.colors.border}`,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1,
                                position: 'relative' // For tooltip positioning
                            }}>
                                <button
                                    onClick={() => setShowPath(!showPath)}
                                    style={{
                                        padding: '3px 8px',
                                        backgroundColor: 'transparent',
                                        color: config.theme.colors.text.primary,
                                        border: `1px solid ${config.theme.colors.border}`,
                                        borderRadius: config.theme.radius.sm,
                                        cursor: 'pointer',
                                        fontSize: '0.65rem',
                                        fontFamily: config.theme.typography.fontFamily.base,
                                        width: '100%',
                                        transition: 'all 0.15s ease',
                                        '&:hover': {
                                            borderColor: config.theme.colors.hover,
                                            color: config.theme.colors.hover
                                        }
                                    }}
                                >
                                    {showPath ? 'Hide file path' : 'Show file path'}
                                </button>

                                {/* Tooltip with Copy Feature */}
                                {showPath && (
                                    <Box sx={{
                                        position: 'absolute',
                                        bottom: '100%',
                                        left: 0,
                                        right: 0,
                                        backgroundColor: config.theme.colors.surface,
                                        border: `1px solid ${config.theme.colors.border}`,
                                        borderRadius: config.theme.radius.sm,
                                        padding: '8px',
                                        marginBottom: '8px',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                                        zIndex: 10,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '4px',
                                        fontFamily: config.theme.typography.fontFamily.base
                                    }}>
                                        {/* Path Display */}
                                        <Box sx={{
                                            fontSize: '0.6rem',
                                            color: config.theme.colors.text.primary,
                                            wordBreak: 'break-all',
                                            paddingRight: '24px',
                                            opacity: 0.85
                                        }}>
                                            {asset.file_path}
                                        </Box>
                                        
                                        {/* Copy Button */}
                                        <button
                                            onClick={() => handleCopy(asset.file_path)}
                                            style={{
                                                padding: '2px 6px',
                                                backgroundColor: copied ? config.theme.colors.success : 'transparent',
                                                color: copied ? '#000' : config.theme.colors.text.primary,
                                                border: 'none',
                                                borderRadius: config.theme.radius.sm,
                                                cursor: 'pointer',
                                                fontSize: '0.65rem',
                                                fontFamily: config.theme.typography.fontFamily.base,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                alignSelf: 'flex-start',
                                                transition: 'all 0.15s ease',
                                                '&:hover': {
                                                    color: config.theme.colors.hover
                                                }
                                            }}
                                        >
                                            {copied ? (
                                                <>✓ Copied</>
                                            ) : (
                                                <>Copy path</>
                                            )}
                                        </button>
                                    </Box>
                                )}

                                {/* Open Folder Button */}
                                <button
                                    onClick={handleOpenFolder}
                                    style={{
                                        padding: '3px 8px',
                                        backgroundColor: 'transparent',
                                        color: config.theme.colors.text.primary,
                                        border: `1px solid ${config.theme.colors.border}`,
                                        borderRadius: config.theme.radius.sm,
                                        cursor: 'pointer',
                                        fontSize: '0.65rem',
                                        fontFamily: config.theme.typography.fontFamily.base,
                                        width: '100%',
                                        transition: 'all 0.15s ease',
                                        '&:hover': {
                                            borderColor: config.theme.colors.hover,
                                            color: config.theme.colors.hover
                                        }
                                    }}
                                >
                                    Open
                                </button>
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </Box>
        </AssetDetailsErrorBoundary>
    );
};

export default AssetDetails; 