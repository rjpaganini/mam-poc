import React, { useState, useEffect } from 'react';
import { Box, Paper } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import config from '../config';
import { openFolder } from '../utils/fileUtils';
import logger from '../services/logger';

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
    const { state } = useLocation();
    const navigate = useNavigate();
    const asset = state?.asset;
    const [videoError, setVideoError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!asset) {
            logger.warn('Asset details accessed without asset data', {
                path: window.location.pathname,
                state
            });
        } else {
            logger.info('Asset details viewed', {
                assetId: asset.id,
                title: asset.title
            });
        }
    }, [asset]);

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

    // Format metadata values for display with error handling
    const formatMetadataValue = (key, value) => {
        try {
            if (typeof value === 'object' && value !== null) {
                if ('channels' in value && 'codec' in value) {
                    return `${value.codec} (${value.channels}ch${value.sample_rate ? `, ${value.sample_rate}Hz` : ''})`;
                }
                if (Array.isArray(value)) {
                    return value.join(' × ');
                }
                return Object.entries(value)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(', ');
            }
            if (typeof value === 'number') {
                if (key === 'duration') return `${Math.round(value)}s`;
                if (key === 'fps') return `${value.toFixed(2)} fps`;
                if (key === 'file_size') return `${(value / (1024 * 1024)).toFixed(1)} MB`;
                return value.toString();
            }
            return value || '-';
        } catch (error) {
            logger.error('Metadata formatting error', error, {
                key,
                value,
                assetId: asset?.id
            });
            return '-';
        }
    };

    // Base container style to ensure dark theme coverage
    const containerStyle = {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: config.theme.colors.background,
        overflow: 'auto',
        padding: config.theme.spacing.lg
    };

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
                    <Box sx={{ color: config.theme.colors.text.primary }}>
                        Asset not found
                    </Box>
                </Box>
            </Box>
        );
    }

    return (
        <AssetDetailsErrorBoundary>
            <Box sx={containerStyle}>
                <Box sx={{ 
                    maxWidth: '1200px', 
                    margin: '0 auto',
                    padding: 2
                }}>
                    {/* Header Section */}
                    <Box sx={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        marginBottom: 3
                    }}>
                        <button 
                            onClick={() => navigate('/')}
                            style={{
                                padding: `${config.theme.spacing.sm} ${config.theme.spacing.md}`,
                                backgroundColor: 'transparent',
                                color: config.theme.colors.text.primary,
                                border: `1px solid ${config.theme.colors.border}`,
                                borderRadius: config.theme.radius.md,
                                cursor: 'pointer'
                            }}
                        >
                            ← Back to Library
                        </button>
                        <h1 style={{ 
                            margin: 0,
                            color: config.theme.colors.text.primary,
                            fontSize: config.theme.fontSize.xl
                        }}>
                            {asset.title}
                        </h1>
                    </Box>

                    {/* Content Section */}
                    <Paper sx={{
                        backgroundColor: config.theme.colors.surface,
                        borderRadius: config.theme.radius.lg,
                        overflow: 'hidden',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}>
                        {/* Video Player with Error Handling */}
                        <Box sx={{ position: 'relative', paddingTop: '56.25%', backgroundColor: '#000' }}>
                            {isLoading && (
                                <Box sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: config.theme.colors.text.primary
                                }}>
                                    Loading video...
                                </Box>
                            )}
                            {videoError && (
                                <Box sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexDirection: 'column',
                                    color: config.theme.colors.error,
                                    p: 2
                                }}>
                                    <div>Failed to load video</div>
                                    <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                                        {videoError.message}
                                    </div>
                                </Box>
                            )}
                            <video
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    display: videoError ? 'none' : 'block'
                                }}
                                controls
                                src={`${config.api.mediaURL}/${encodeURIComponent(asset.file_path.split('/').pop())}`}
                                onLoadedMetadata={handleVideoLoad}
                                onError={handleVideoError}
                            />
                        </Box>

                        {/* Metadata Section */}
                        <Box sx={{ p: 3 }}>
                            <Box sx={{ 
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: 3,
                                color: config.theme.colors.text.secondary
                            }}>
                                {/* File Size (displayed first) */}
                                <Box>
                                    <Box sx={{ 
                                        fontSize: '0.875rem',
                                        color: config.theme.colors.text.primary,
                                        mb: 1
                                    }}>
                                        File Size
                                    </Box>
                                    <Box sx={{ fontSize: '1rem' }}>
                                        {formatMetadataValue('file_size', asset.file_size)}
                                    </Box>
                                </Box>
                                
                                {/* Other metadata */}
                                {asset.media_metadata && Object.entries(asset.media_metadata).map(([key, value]) => (
                                    key !== 'file_size' && (
                                        <Box key={key}>
                                            <Box sx={{ 
                                                fontSize: '0.875rem',
                                                color: config.theme.colors.text.primary,
                                                mb: 1,
                                                textTransform: 'capitalize'
                                            }}>
                                                {key.replace(/_/g, ' ')}
                                            </Box>
                                            <Box sx={{ fontSize: '1rem' }}>
                                                {formatMetadataValue(key, value)}
                                            </Box>
                                        </Box>
                                    )
                                ))}
                            </Box>

                            {/* File Path with Open in Finder */}
                            <Box sx={{ 
                                mt: 3,
                                pt: 2,
                                borderTop: `1px solid ${config.theme.colors.border}`,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <Box sx={{ 
                                    fontSize: '0.875rem',
                                    color: config.theme.colors.text.secondary,
                                    wordBreak: 'break-all',
                                    flex: 1
                                }}>
                                    {asset.file_path}
                                </Box>
                                <button
                                    onClick={handleOpenFolder}
                                    style={{
                                        padding: `${config.theme.spacing.sm} ${config.theme.spacing.md}`,
                                        backgroundColor: 'transparent',
                                        color: config.theme.colors.text.primary,
                                        border: `1px solid ${config.theme.colors.border}`,
                                        borderRadius: config.theme.radius.md,
                                        cursor: 'pointer',
                                        marginLeft: config.theme.spacing.md,
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    Open in Finder
                                </button>
                            </Box>
                        </Box>
                    </Paper>
                </Box>
            </Box>
        </AssetDetailsErrorBoundary>
    );
};

export default AssetDetails; 