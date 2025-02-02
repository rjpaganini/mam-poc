import React, { useState, useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import config from '../../config';
import { formatFileSize } from '../../utils/formatters';
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

// Updated styles to handle both elements being always present
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
        pointerEvents: 'auto', // Enable mouse events when hovered
        cursor: 'col-resize'   // Show scrubbing cursor
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
        padding: config.theme.spacing.md
    },
    title: {
        margin: 0,
        marginBottom: config.theme.spacing.sm,
        color: config.theme.colors.text.primary,
        fontSize: config.theme.fontSize.md,
        fontWeight: config.theme.fontWeight.bold,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    },
    metadataGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: config.theme.spacing.xs,
        fontSize: config.theme.fontSize.sm
    },
    metadataItem: {
        color: config.theme.colors.text.secondary
    }
};

// Format metadata values for clean display
const formatMetadata = (value, type) => {
    switch(type) {
        case 'duration': return `${Math.round(value)}s`;
        case 'resolution': return value.join('×');
        case 'fps': return `${Number(value).toFixed(1)} fps`;
        case 'size': return formatFileSize(value);
        case 'codec': return value || '-';
        case 'bitrate': return `${formatFileSize(value)}/s`;
        default: return value;
    }
};

// Helper function to construct thumbnail URLs
const getThumbnailUrl = (thumbnailPath) => {
    if (!thumbnailPath) return null;
    // Remove leading slash if present
    const cleanPath = thumbnailPath.startsWith('/') ? thumbnailPath.slice(1) : thumbnailPath;
    // Remove /thumbnails/ prefix if present
    const filename = cleanPath.replace(/^thumbnails\//, '');
    return `${config.api.thumbnailURL}/${filename}`;
};

// Cache for successful thumbnail loads
const thumbnailCache = new Map();

// Cache for loaded videos to prevent duplicate requests
const videoCache = new Map();

// Enhanced media loader with preloading support
const useMediaLoader = (asset) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const videoRef = useRef(null);
    const loadAttempts = useRef(0);
    const MAX_RETRIES = 3;

    useEffect(() => {
        if (!asset?.file_path) {
            logger.warn('Asset missing file_path', { assetId: asset?.id });
            return;
        }
        
        const filename = asset.file_path.split('/').pop();
        const videoUrl = `${config.api.mediaURL}/${encodeURIComponent(filename)}`;
        
        // Start performance timer
        logger.startTimer(`video-load-${asset.id}`);
        
        // Check cache first
        if (videoCache.has(videoUrl)) {
            setIsLoaded(true);
            setIsLoading(false);
            logger.debug('Video loaded from cache', { assetId: asset.id, url: videoUrl });
            return;
        }

        // Create video element for metadata loading
        const video = document.createElement('video');
        video.preload = 'metadata';
        
        video.onloadedmetadata = () => {
            videoCache.set(videoUrl, true);
            setIsLoaded(true);
            setIsLoading(false);
            logger.info('Video metadata loaded', {
                assetId: asset.id,
                duration: video.duration,
                size: video.videoWidth + 'x' + video.videoHeight
            });
            logger.endTimer(`video-load-${asset.id}`);
        };

        video.onerror = (error) => {
            loadAttempts.current++;
            logger.error('Video metadata load failed', error, {
                assetId: asset.id,
                url: videoUrl,
                attempt: loadAttempts.current
            });

            if (loadAttempts.current < MAX_RETRIES) {
                // Retry loading after exponential backoff
                setTimeout(() => {
                    video.src = videoUrl;
                }, Math.pow(2, loadAttempts.current) * 1000);
            } else {
                setHasError(true);
                setIsLoading(false);
                logger.error('Video load failed after max retries', error, {
                    assetId: asset.id,
                    maxRetries: MAX_RETRIES
                });
            }
        };

        // Set up fetch with proper headers
        const controller = new AbortController();
        const headers = new Headers({
            'Range': 'bytes=0-1024',
            'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        });

        fetch(videoUrl, {
            method: 'GET',
            headers: headers,
            signal: controller.signal,
            credentials: 'same-origin'
        }).then(response => {
            if (response.ok || response.status === 206) {
                video.src = videoUrl;
                logger.debug('Video fetch successful', {
                    assetId: asset.id,
                    status: response.status,
                    contentType: response.headers.get('content-type')
                });
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        }).catch(error => {
            if (error.name === 'AbortError') {
                logger.debug('Video fetch aborted', { assetId: asset.id });
                return;
            }
            logger.error('Video fetch failed', error, {
                assetId: asset.id,
                url: videoUrl
            });
            setHasError(true);
            setIsLoading(false);
        });

        return () => {
            controller.abort();
            video.onloadedmetadata = null;
            video.onerror = null;
            video.src = '';
            logger.debug('Video load cleanup', { assetId: asset.id });
        };
    }, [asset]);

    return { isLoaded, hasError, isLoading, videoRef };
};

// Simple card component for media assets
export const AssetCard = ({ asset, onClick }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const { isLoaded, hasError, isLoading, videoRef } = useMediaLoader(asset);
    
    // Prevent any rendering if asset is invalid
    if (!asset?.file_path) return null;
    
    // Extract just the filename from the full path for the video URL
    const filename = asset.file_path.split('/').pop();
    const videoUrl = `${config.api.mediaURL}/${encodeURIComponent(filename)}`;
    const thumbnailUrl = asset?.media_metadata?.thumbnail_url 
        ? getThumbnailUrl(asset.media_metadata.thumbnail_url)
        : null;

    // Handle video scrubbing
    const handleMouseMove = (e) => {
        if (isHovered && videoRef.current?.duration) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const scrubPosition = (x / rect.width) * videoRef.current.duration;
            videoRef.current.currentTime = Math.max(0, Math.min(scrubPosition, videoRef.current.duration));
        }
    };

    const handleMouseEnter = () => {
        setIsHovered(true);
        if (videoRef.current) {
            // Reset video state
            videoRef.current.currentTime = 0;
            
            // Only attempt autoplay if video is loaded
            if (isVideoReady) {
                const playPromise = videoRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(() => {
                        // Suppress autoplay error - this is expected on first interaction
                        console.warn('Video autoplay failed - user interaction may be needed');
                    });
                }
            }
        }
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    };

    const handleVideoLoaded = () => {
        setIsVideoReady(true);
        if (isHovered && videoRef.current) {
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    // Suppress autoplay error
                });
            }
        }
    };

    const handleVideoError = (e) => {
        console.error(`Video load error for ${asset.title}:`, e);
        setIsVideoReady(false);
        // Retry loading after a short delay
        setTimeout(() => {
            if (videoRef.current) {
                videoRef.current.load();
            }
        }, 2000);
    };

    return (
        <AssetCardErrorBoundary>
            <Box
                sx={styles.card}
                onClick={onClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onMouseMove={handleMouseMove}
            >
                <Box sx={styles.mediaContainer}>
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
                        onError={handleVideoError}
                        crossOrigin="anonymous"
                    />
                </Box>
                <div style={styles.content}>
                    <h3 style={styles.title}>{asset.title}</h3>
                    <div style={styles.metadataGrid}>
                        {Object.entries({
                            resolution: asset.media_metadata?.resolution,
                            duration: asset.media_metadata?.duration,
                            fps: asset.media_metadata?.fps,
                            size: asset.media_metadata?.file_size,
                            codec: asset.media_metadata?.codec,
                            bitrate: asset.media_metadata?.bitrate
                        }).map(([key, value]) => value && (
                            <div key={key} style={styles.metadataItem}>
                                {formatMetadata(value, key)}
                            </div>
                        ))}
                    </div>
                </div>
            </Box>
        </AssetCardErrorBoundary>
    );
};

export default AssetCard; 