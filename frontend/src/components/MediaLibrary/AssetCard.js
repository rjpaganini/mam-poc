/**
 * AssetCard.js
 * Simple video preview with scrubbing for Electron
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardMedia, Typography, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import { PlayArrow, Pause, Error } from '@mui/icons-material';
import { formatDuration, formatFileSize, formatFPS } from '../../utils/formatters';
import config from '../../config';

const StyledCard = styled(Card)(({ theme }) => ({
    position: 'relative',
    cursor: 'pointer',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.2s ease-in-out',
    '&:hover': {
        transform: 'scale(1.02)'
    }
}));

const MediaContainer = styled('div')({
    position: 'relative',
    paddingTop: '56.25%', // 16:9 aspect ratio
    backgroundColor: '#000',
    flex: '1 1 auto' // Allow flex growing
});

const StyledVideo = styled('video')({
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    cursor: 'pointer'
});

const StyledCardMedia = styled(CardMedia)({
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain'
});

const PlayButton = styled(IconButton)(({ theme }) => ({
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    color: '#fff',
    '&:hover': {
        backgroundColor: 'rgba(0, 0, 0, 0.8)'
    }
}));

const ErrorOverlay = styled('div')(({ theme }) => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: theme.palette.error.main
}));

const StyledCardContent = styled(CardContent)(({ theme }) => ({
    padding: theme.spacing(0.5),
    paddingBottom: `${theme.spacing(0.5)} !important`,
    backgroundColor: theme.palette.background.paper,
    borderTop: `1px solid ${theme.palette.divider}`,
    flex: '0 0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25)
}));

const MetadataGrid = styled('div')(({ theme }) => ({
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)', // Two columns
    gap: theme.spacing(0.25), // Tighter gap
    fontSize: '0.6rem' // Set base font size for all children
}));

const AssetCard = ({ asset, onClick }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isMouseOver, setIsMouseOver] = useState(false);
    const videoRef = React.useRef(null);
    const playTimeoutRef = React.useRef(null);

    // Construct proper URLs
    const thumbnailUrl = `http://localhost:5001/api/v1/thumbnails/${asset.id}.jpg`;
    const previewUrl = asset.file_path ? `video://${encodeURIComponent(asset.file_path)}` : '';

    // Cleanup function
    useEffect(() => {
        return () => {
            if (playTimeoutRef.current) {
                clearTimeout(playTimeoutRef.current);
            }
        };
    }, []);

    const handleMouseEnter = () => {
        setIsMouseOver(true);
        if (!hasError && videoRef.current && isLoaded) {
            // Restore video source first
            if (!videoRef.current.getAttribute('src')) {
                videoRef.current.setAttribute('src', previewUrl);
                videoRef.current.load();
            }
            // Delay play slightly to avoid rapid play/pause on quick mouse movements
            playTimeoutRef.current = setTimeout(() => {
                videoRef.current.play().catch((error) => {
                    if (error.name !== 'AbortError') {
                        console.error('Failed to play video:', error, previewUrl);
                        setHasError(true);
                    }
                });
            }, 100);
        }
    };

    const handleMouseLeave = () => {
        setIsMouseOver(false);
        if (playTimeoutRef.current) {
            clearTimeout(playTimeoutRef.current);
        }
        if (!hasError && videoRef.current) {
            videoRef.current.pause();
            videoRef.current.removeAttribute('src');
            videoRef.current.load();
            setIsPlaying(false);
        }
    };

    const handleLoadedMetadata = () => {
        setIsLoaded(true);
        if (isMouseOver && !hasError && videoRef.current) {
            videoRef.current.play().catch(() => {});
        }
    };

    // Add scrubbing functionality with improved validation
    const handleMouseMove = (e) => {
        if (!videoRef.current || hasError || !isLoaded) return;

        try {
            const video = videoRef.current;
            const rect = e.currentTarget.getBoundingClientRect();
            
            // Ensure we have valid dimensions
            if (rect.width <= 0) return;
            
            // Calculate x position with bounds
            const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            const percentage = x / rect.width;
            
            // Validate duration and calculate new time
            const duration = video.duration;
            if (typeof duration !== 'number' || !isFinite(duration) || duration <= 0) {
                return;
            }
            
            const newTime = percentage * duration;
            
            // Extra validation before setting time
            if (typeof newTime === 'number' && 
                isFinite(newTime) && 
                newTime >= 0 && 
                newTime <= duration) {
                video.currentTime = newTime;
            }
        } catch (error) {
            console.warn('Error during video scrubbing:', error);
        }
    };

    const handleVideoError = () => {
        console.error('Video error for:', previewUrl);
        setHasError(true);
        setIsPlaying(false);
        setIsLoaded(false);
    };

    return (
        <StyledCard 
            onClick={onClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <MediaContainer onMouseMove={handleMouseMove}>
                <StyledVideo
                    ref={videoRef}
                    src={previewUrl}
                    poster={thumbnailUrl}
                    preload="metadata"
                    onLoadedMetadata={handleLoadedMetadata}
                    onError={handleVideoError}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    muted
                    playsInline
                />
                
                {hasError && (
                    <ErrorOverlay>
                        <Error sx={{ fontSize: 40 }} />
                    </ErrorOverlay>
                )}
            </MediaContainer>

            <StyledCardContent>
                <Typography 
                    variant="subtitle1" 
                    noWrap 
                    sx={{ 
                        fontSize: '0.7rem', 
                        fontWeight: 'medium',
                        lineHeight: 1.2 // Tighter line height for title
                    }}
                >
                    {asset.title}
                </Typography>
                
                <MetadataGrid>
                    <Typography 
                        variant="caption" 
                        sx={{ 
                            fontSize: 'inherit',
                            color: 'text.secondary',
                            lineHeight: 1.2
                        }}
                    >
                        Duration: {formatDuration(asset.duration)}
                    </Typography>
                    <Typography 
                        variant="caption" 
                        sx={{ 
                            fontSize: 'inherit',
                            color: 'text.secondary',
                            lineHeight: 1.2
                        }}
                    >
                        Size: {formatFileSize(asset.file_size)}
                    </Typography>
                    <Typography 
                        variant="caption" 
                        sx={{ 
                            fontSize: 'inherit',
                            color: 'text.secondary',
                            lineHeight: 1.2
                        }}
                    >
                        Format: {asset.file_path?.split('.').pop()?.toUpperCase() || '-'}
                    </Typography>
                    {asset.fps && (
                        <Typography 
                            variant="caption" 
                            sx={{ 
                                fontSize: 'inherit',
                                color: 'text.secondary',
                                lineHeight: 1.2
                            }}
                        >
                            FPS: {formatFPS(asset.fps)}
                        </Typography>
                    )}
                    {asset.codec && (
                        <Typography 
                            variant="caption" 
                            sx={{ 
                                fontSize: 'inherit',
                                color: 'text.secondary',
                                lineHeight: 1.2
                            }}
                        >
                            Codec: {asset.codec.toUpperCase()}
                        </Typography>
                    )}
                    {asset.width && asset.height && (
                        <Typography 
                            variant="caption" 
                            sx={{ 
                                fontSize: 'inherit',
                                color: 'text.secondary',
                                lineHeight: 1.2
                            }}
                        >
                            Resolution: {asset.width}×{asset.height}
                        </Typography>
                    )}
                </MetadataGrid>
            </StyledCardContent>
        </StyledCard>
    );
};

export default AssetCard; 