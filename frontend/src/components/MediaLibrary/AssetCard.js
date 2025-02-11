/**
 * AssetCard.js - Core media asset display
 * Optimized for minimal token usage
 * Sr Dev - 2024
 */

import React from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { styled } from '@mui/material/styles';
import config from '../../config';

// Styled components for performance
const Card = styled(Box)({
    position: 'relative',
    width: '100%',
    aspectRatio: '16/9',
    bgcolor: 'background.paper',
    borderRadius: 1,
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'transform 0.2s',
    '&:hover': { transform: 'scale(1.02)' }
});

const Thumb = styled('img')({
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover'
});

const Info = styled(Box)({
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    p: 1,
    background: 'rgba(0,0,0,0.7)',
    color: '#fff'
});

// Error boundary - minimal implementation
class ErrBound extends React.Component {
    state = { err: null };
    
    static getDerivedStateFromError(err) {
        return { err };
    }
    
    render() {
        return this.state.err ? (
            <Card>
                <Typography color="error" p={1}>
                    Failed to load asset
                </Typography>
            </Card>
        ) : this.props.children;
    }
}

// Core component with minimal props
const AssetCard = ({ asset, onClick }) => {
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(false);
    
    // Get thumbnail URL from metadata
    const thumbnailUrl = React.useMemo(() => {
        if (!asset?.thumbnail_url) return null;
        return `${config.api.baseURL}${asset.thumbnail_url}`;
    }, [asset]);
    
    const getMeta = React.useMemo(() => {
        const { format, file_size_mb, duration_formatted } = asset;
        return {
            type: format?.toUpperCase() || 'UNKNOWN',
            size: `${file_size_mb}MB`,
            duration: duration_formatted || '00:00'
        };
    }, [asset]);
    
    // Event handlers
    const handleClick = React.useCallback(() => {
        onClick?.(asset);
    }, [asset, onClick]);
    
    const handleLoad = React.useCallback(() => {
        setLoading(false);
        setError(false);
    }, []);
    
    const handleError = React.useCallback(() => {
        setLoading(false);
        setError(true);
    }, []);
    
    return (
        <ErrBound>
            <Card onClick={handleClick}>
                {loading && !error && (
                    <Skeleton 
                        variant="rectangular" 
                        width="100%" 
                        height="100%" 
                        animation="wave"
                    />
                )}
                
                {error && (
                    <Box sx={{ 
                        height: '100%', 
                        display: 'flex', 
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'background.paper'
                    }}>
                        <Typography color="error" variant="caption">
                            Thumbnail unavailable
                        </Typography>
                    </Box>
                )}
                
                {thumbnailUrl && (
                    <Thumb 
                        src={thumbnailUrl}
                        alt={asset.title || 'Media Asset'}
                        onLoad={handleLoad}
                        onError={handleError}
                        loading="lazy"
                        style={{ display: loading ? 'none' : 'block' }}
                    />
                )}
                
                <Info>
                    <Typography variant="caption">
                        {asset.title || 'Untitled'} • {getMeta.type} • {getMeta.size} • {getMeta.duration}
                    </Typography>
                </Info>
            </Card>
        </ErrBound>
    );
};

export default React.memo(AssetCard); 