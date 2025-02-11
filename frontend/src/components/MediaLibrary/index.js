import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, TextField, IconButton } from '@mui/material';
import { GridView, List, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import config from '../../config';  // Add config import

// Simple styled components
const styles = {
    container: {
        padding: '20px',
        maxWidth: '1400px',
        margin: '0 auto'
    },
    toolbar: {
        display: 'flex',
        gap: '12px',
        marginBottom: '20px',
        alignItems: 'center'
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '20px'
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    card: {
        position: 'relative',
        aspectRatio: '16/9',
        backgroundColor: '#2d2d2d',
        borderRadius: '4px',
        overflow: 'hidden',
        cursor: 'pointer'
    },
    thumbnail: {
        width: '100%',
        height: '100%',
        objectFit: 'cover'
    },
    info: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '8px',
        background: 'rgba(0,0,0,0.7)',
        color: '#fff'
    },
    listItem: {
        display: 'flex',
        padding: '8px',
        gap: '12px',
        backgroundColor: '#2d2d2d',
        borderRadius: '4px',
        cursor: 'pointer',
        alignItems: 'center'
    },
    listThumb: {
        width: '120px',
        height: '67.5px',
        objectFit: 'cover',
        borderRadius: '2px'
    }
};

// Format file size
const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Format duration
const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const MediaLibrary = ({ assets = [] }) => {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('title');
    const [sortDirection, setSortDirection] = useState('asc');
    
    // Filter and sort assets
    const displayedAssets = useMemo(() => {
        return [...assets]
            .filter(asset => 
                !searchQuery || 
                asset.title?.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .sort((a, b) => {
                let comparison = 0;
                switch (sortBy) {
                    case 'title':
                        comparison = (a.title || '').localeCompare(b.title || '');
                        break;
                    case 'duration':
                        comparison = (a.duration || 0) - (b.duration || 0);
                        break;
                    case 'size':
                        comparison = (a.file_size || 0) - (b.file_size || 0);
                        break;
                    default:
                        comparison = 0;
                }
                return sortDirection === 'asc' ? comparison : -comparison;
            });
    }, [assets, searchQuery, sortBy, sortDirection]);
    
    // Render asset card/list item
    const renderAsset = (asset) => {
        // Construct full thumbnail URL
        const thumbnailUrl = asset.thumbnail_url 
            ? `${config.api.baseURL}${asset.thumbnail_url}` 
            : null;
            
        if (viewMode === 'grid') {
            return (
                <div 
                    key={asset.id}
                    style={styles.card}
                    onClick={() => navigate(`/asset/${asset.id}`)}
                >
                    {thumbnailUrl && (
                        <img 
                            src={thumbnailUrl} 
                            alt={asset.title} 
                            style={styles.thumbnail}
                            loading="lazy"
                            onError={(e) => {
                                console.error(`Failed to load thumbnail: ${thumbnailUrl}`);
                                e.target.style.display = 'none';
                            }}
                        />
                    )}
                    <div style={styles.info}>
                        <Typography variant="body2">
                            {asset.title}
                        </Typography>
                        <Typography variant="caption">
                            {formatDuration(asset.duration)} • {formatSize(asset.file_size)}
                        </Typography>
                    </div>
                </div>
            );
        }
        
        return (
            <div 
                key={asset.id}
                style={styles.listItem}
                onClick={() => navigate(`/asset/${asset.id}`)}
            >
                {thumbnailUrl && (
                    <img 
                        src={thumbnailUrl} 
                        alt={asset.title} 
                        style={styles.listThumb}
                        loading="lazy"
                    />
                )}
                <div>
                    <Typography variant="body1">{asset.title}</Typography>
                    <Typography variant="caption">
                        {formatDuration(asset.duration)} • {formatSize(asset.file_size)}
                    </Typography>
                </div>
            </div>
        );
    };
    
    return (
        <div style={styles.container}>
            <div style={styles.toolbar}>
                <TextField
                    size="small"
                    placeholder="Search assets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    sx={{ flex: 1 }}
                />
                
                <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{
                        padding: '8px',
                        borderRadius: '4px',
                        backgroundColor: '#2d2d2d',
                        color: '#fff',
                        border: '1px solid #404040'
                    }}
                >
                    <option value="title">Sort by Title</option>
                    <option value="duration">Sort by Duration</option>
                    <option value="size">Sort by Size</option>
                </select>
                
                <IconButton 
                    onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
                    size="small"
                >
                    {sortDirection === 'asc' ? <ArrowUpward /> : <ArrowDownward />}
                </IconButton>
                
                <IconButton 
                    onClick={() => setViewMode(m => m === 'grid' ? 'list' : 'grid')}
                    size="small"
                >
                    {viewMode === 'grid' ? <List /> : <GridView />}
                </IconButton>
            </div>
            
            <div style={viewMode === 'grid' ? styles.grid : styles.list}>
                {displayedAssets.map(renderAsset)}
            </div>
            
            {displayedAssets.length === 0 && (
                <Typography 
                    variant="body1" 
                    sx={{ textAlign: 'center', mt: 4, color: 'text.secondary' }}
                >
                    {searchQuery ? 'No matching assets found' : 'No assets available'}
                </Typography>
            )}
        </div>
    );
};

export default MediaLibrary; 