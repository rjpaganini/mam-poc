import React, { useState, useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import config from '../../config';
import { formatFileSize, formatDuration } from '../../utils/formatters';
import logger from '../../services/logger';

// Error boundary for asset card rendering
class AssetCardErrorBoundary extends React.Component {
    state = { hasError: false, error: null };

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        logger.error('AssetCard render failed', error, {
            component: 'AssetCard',
            errorInfo,
            assetId: this.props.asset?.id
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, color: 'error.main' }}>
                    Failed to load asset
                </Box>
            );
        }
        return this.props.children;
    }
}

// Updated styles with safe theme access and fallbacks
const styles = {
    card: {
        backgroundColor: config.theme.colors.surface,
        borderRadius: config.theme.radius.lg,
        overflow: 'hidden',
        border: `1px solid ${config.theme.colors.border}`,
        cursor: 'pointer'
    },
    mediaContainer: {
        position: 'relative',
        paddingTop: '56.25%', // 16:9 aspect ratio
        backgroundColor: config.theme.colors.background,
        overflow: 'hidden'
    },
    mediaElements: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        pointerEvents: 'none'
    },
    videoHovered: {
        pointerEvents: 'auto',
        cursor: 'col-resize'
    },
    hidden: {
        visibility: 'hidden',
        opacity: 0
    },
    visible: {
        visibility: 'visible',
        opacity: 1
    },
    thumbnail: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        backgroundColor: config.theme.colors.background
    },
    video: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover'
    },
    content: {
        padding: '6px 8px',
    },
    title: {
        margin: 0,
        marginBottom: '4px',
        color: theme => theme.palette.text.primary,
        fontSize: '0.7rem !important',
        fontWeight: theme => theme.typography.fontWeightMedium,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        lineHeight: 1.2,
        fontFamily: theme => theme.typography.fontFamily.base
    },
    metadataGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gridTemplateRows: 'repeat(3, auto)',
        gap: '1px 3px',
        padding: 0,
        marginTop: '1px'
    },
    metadataItem: {
        color: theme => theme.palette.text.secondary,
        display: 'flex',
        alignItems: 'baseline',
        gap: '1px',
        fontSize: '0.4rem !important',
        fontFamily: theme => theme.typography.fontFamily.base,
        lineHeight: 1
    },
    metadataLabel: {
        color: theme => theme.palette.text.secondary,
        fontWeight: theme => theme.typography.fontWeightMedium,
        fontSize: '0.4rem !important',
        opacity: 0.7,
        whiteSpace: 'nowrap',
        fontFamily: theme => theme.typography.fontFamily.base,
        lineHeight: 1
    },
    metadataValue: {
        color: theme => theme.palette.text.primary,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        fontSize: '0.4rem !important',
        fontWeight: theme => theme.typography.fontWeightMedium,
        flex: 1,
        fontFamily: theme => theme.typography.fontFamily.base,
        lineHeight: 1
    }
};

// Format metadata values for clean display
const formatMetadata = (value, type) => {
    if (!value || value === '-') return '-';
    
    switch(type) {
        case 'duration':
            return formatDuration(value);
        case 'resolution':
            return value; // Resolution is already formatted
        case 'fps':
            return Number(value).toFixed(2); // Limit to 2 decimal places
        case 'size':
            // Ensure we're handling a number
            const size = typeof value === 'number' ? value : parseInt(value, 10);
            return formatFileSize(size);
        case 'codec':
            return value.toString().toUpperCase();
        case 'format':
            return value.toString().toUpperCase();
        case 'bitrate':
            // Convert to Mbps with proper formatting
            const mbps = value / 1000000;
            return mbps >= 1 ? 
                `${mbps.toFixed(1)} Mbps` : 
                `${(value / 1000).toFixed(0)} Kbps`;
        default:
            return value.toString();
    }
};

// Enhanced thumbnail URL generator with caching
const getThumbnailUrl = (thumbnailPath) => {
    if (!thumbnailPath) return null;
    // Remove leading slash if present
    const cleanPath = thumbnailPath.startsWith('/') ? thumbnailPath.slice(1) : thumbnailPath;
    // Remove /thumbnails/ prefix if present
    const filename = cleanPath.replace(/^thumbnails\//, '');
    return `${config.api.thumbnailURL}/${filename}`;
};

// Cache for preloaded videos and thumbnails with timestamp tracking
const videoCache = new Map();
const thumbnailCache = new Map();
const videoLoadingPromises = new Map();

/**
 * Enhanced media loader hook with better error handling and loading states
 */
const useMediaLoader = (asset) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const videoRef = useRef(null);
    const retryCount = useRef(0);
    const MAX_RETRIES = 3;

    useEffect(() => {
        if (!asset?.file_path) return;
        let isMounted = true;

        const loadMedia = async () => {
            try {
                // Show thumbnail immediately while video loads
                setIsLoading(false);
                
                // Check if already loading
                if (videoLoadingPromises.has(asset.id)) {
                    await videoLoadingPromises.get(asset.id);
                    if (isMounted) {
                        setIsVideoReady(true);
                    }
                    return;
                }

                // Check cache first
                if (videoCache.has(asset.id)) {
                    if (isMounted) {
                        setIsVideoReady(true);
                    }
                    return;
                }

                // Create loading promise
                const loadPromise = new Promise(async (resolve, reject) => {
                    try {
                        if (videoRef.current) {
                            const videoPath = encodeURIComponent(asset.file_path.split('/').pop());
                            const videoUrl = `${config.api.mediaURL}/${videoPath}`;

                            // Set up video event handlers
                            videoRef.current.onloadedmetadata = () => {
                                videoRef.current.preload = 'metadata';
                            };

                            videoRef.current.oncanplaythrough = () => {
                                if (isMounted) {
                                    setIsVideoReady(true);
                                    videoCache.set(asset.id, {
                                        video: videoRef.current,
                                        timestamp: Date.now()
                                    });
                                    resolve();
                                }
                            };

                            videoRef.current.onerror = (e) => {
                                const error = e.target.error;
                                logger.error('Video load error:', {
                                    code: error.code,
                                    message: error.message,
                                    assetId: asset.id,
                                    retryCount: retryCount.current
                                });
                                reject(error);
                            };

                            videoRef.current.src = videoUrl;
                            await videoRef.current.load();
                        }
                    } catch (error) {
                        reject(error);
                    }
                });

                videoLoadingPromises.set(asset.id, loadPromise);
                await loadPromise;

            } catch (error) {
                if (retryCount.current < MAX_RETRIES) {
                    retryCount.current++;
                    await new Promise(r => setTimeout(r, 1000 * retryCount.current));
                    await loadMedia();
                } else {
                    setLoadError(error);
                    logger.error('Failed to load media after retries:', {
                        error,
                        assetId: asset.id,
                        retries: retryCount.current
                    });
                }
            } finally {
                videoLoadingPromises.delete(asset.id);
            }
        };

        loadMedia();
        return () => {
            isMounted = false;
            if (videoRef.current) {
                videoRef.current.onloadedmetadata = null;
                videoRef.current.oncanplaythrough = null;
                videoRef.current.onerror = null;
            }
        };
    }, [asset]);

    return { isLoading, isVideoReady, loadError, setIsVideoReady, videoRef };
};

const handleVideoError = (e, asset, videoRef) => {
    const error = e.target.error;
    logger.error('Video load error:', {
        assetId: asset.id,
        title: asset.title,
        code: error?.code,
        message: error?.message,
        src: videoRef.current?.src
    });

    // Check if video source is accessible
    fetch(videoRef.current?.src, { method: 'HEAD' })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // If HEAD request succeeds but video still fails, might be a codec issue
            logger.warn('Video source is accessible but playback failed', {
                assetId: asset.id,
                status: response.status,
                contentType: response.headers.get('content-type')
            });
        })
        .catch(fetchError => {
            logger.error('Video source is not accessible', {
                assetId: asset.id,
                error: fetchError.message
            });
        });
};

// Simple card component for media assets
export const AssetCard = ({ asset, onClick }) => {
    // Add debug logging
    console.log('AssetCard received asset:', {
        id: asset?.id,
        title: asset?.title,
        file_size: asset?.file_size,
        metadata: asset?.media_metadata
    });
    
    const [isHovered, setIsHovered] = useState(false);
    const { isLoading, isVideoReady, loadError, setIsVideoReady, videoRef } = useMediaLoader(asset);
    
    // Add scrubbing state
    const [isDragging, setIsDragging] = useState(false);
    
    // Prevent any rendering if asset is invalid
    if (!asset?.file_path) return null;
    
    // Extract just the filename from the full path for the video URL
    const filename = asset.file_path.split('/').pop();
    const videoUrl = `${config.api.mediaURL}/${encodeURIComponent(filename)}`;
    const thumbnailUrl = asset?.media_metadata?.thumbnail_url 
        ? getThumbnailUrl(asset.media_metadata.thumbnail_url)
        : null;

    // Handle hover states and video playback
    const handleMouseEnter = () => {
        setIsHovered(true);
        if (videoRef.current && isVideoReady) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(() => {
                // Suppress expected autoplay errors
            });
        }
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        setIsDragging(false);
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    };

    // Enhanced mouse handlers
    const handleMouseMove = (e) => {
        if (!isVideoReady || !videoRef.current || !isHovered || loadError) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;
        
        if (videoRef.current.duration) {
            // Ensure smooth scrubbing
            requestAnimationFrame(() => {
                if (videoRef.current) {
                    videoRef.current.currentTime = percentage * videoRef.current.duration;
                }
            });
        }
    };

    const handleMouseDown = () => {
        if (isVideoReady && videoRef.current) {
            setIsDragging(true);
            videoRef.current.pause();
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        if (isVideoReady && videoRef.current && isHovered) {
            videoRef.current.play().catch(() => {});
        }
    };

    const handleVideoLoaded = () => {
        setIsVideoReady(true);
    };

    // Get metadata items for display
    const getMetadataItems = () => {
        if (!asset.media_metadata) return [];

        const metadata = asset.media_metadata;
        return [
            {
                label: 'Size',
                value: asset.file_size,
                type: 'size'
            },
            {
                label: 'Res',
                value: metadata.width && metadata.height ? `${metadata.width}×${metadata.height}` : '-',
                type: 'resolution'
            },
            {
                label: 'Dur',
                value: metadata.duration || '-',
                type: 'duration'
            },
            {
                label: 'FPS',
                value: metadata.fps || '-',
                type: 'fps'
            },
            {
                label: 'Codec',
                value: metadata.codec || '-',
                type: 'codec'
            },
            {
                label: 'Format',
                value: asset.file_path ? asset.file_path.split('.').pop() : '-',
                type: 'format'
            }
        ];
    };

    return (
        <AssetCardErrorBoundary>
            <Box
                sx={styles.card}
                onClick={onClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <Box sx={styles.mediaContainer}
                    onMouseMove={handleMouseMove}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                >
                    {isLoading && (
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(0,0,0,0.5)',
                            color: 'white',
                            zIndex: 1
                        }}>
                            Loading...
                        </div>
                    )}
                    {thumbnailUrl && (
                        <img
                            src={thumbnailUrl}
                            alt={asset.title}
                            style={{
                                ...styles.mediaElements,
                                opacity: isHovered ? 0 : 1,
                                transition: 'opacity 0.2s ease-in-out'
                            }}
                            onError={(e) => {
                                logger.error('Thumbnail load failed', {
                                    assetId: asset.id,
                                    url: thumbnailUrl
                                });
                                e.target.style.display = 'none';
                            }}
                        />
                    )}
                    <video
                        ref={videoRef}
                        src={videoUrl}
                        style={{
                            ...styles.mediaElements,
                            ...((isHovered && isVideoReady) ? styles.videoHovered : {}),
                            display: (isHovered && isVideoReady) ? 'block' : 'none'
                        }}
                        preload="metadata"
                        muted
                        playsInline
                        loop
                        onLoadedMetadata={handleVideoLoaded}
                        onError={(e) => handleVideoError(e, asset, videoRef)}
                        crossOrigin="anonymous"
                    />
                </Box>
                <div style={styles.content}>
                    <h3 style={styles.title}>{asset.title}</h3>
                    <div style={styles.metadataGrid}>
                        {getMetadataItems().map(({ label, value, type }) => (
                            <div key={label} style={styles.metadataItem}>
                                <span style={styles.metadataLabel}>{label}:</span>
                                <span style={styles.metadataValue}>
                                    {formatMetadata(value, type)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </Box>
        </AssetCardErrorBoundary>
    );
};

export default AssetCard; 