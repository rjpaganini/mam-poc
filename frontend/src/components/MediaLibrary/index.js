import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, useTheme, InputBase, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import config from '../../config';
import AssetCard from './AssetCard';
import { ListView } from './ListView';
import { ViewToggle } from './ViewToggle';
import { colors } from '../../theme/theme';  // Import colors from theme

// Add styled component for search input
const SearchInput = styled(InputBase)(({ theme }) => ({
    height: '24px',
    minWidth: '200px',
    flex: '1 1 auto',
    fontSize: '0.7rem',
    padding: '0 8px',
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    color: theme.palette.text.primary,
    transition: 'border-color 0.2s',
    '&.Mui-focused': {
        borderColor: `${colors.accent} !important`,
        '& .MuiInputBase-input': {
            outline: 'none'
        }
    },
    '&:hover': {
        borderColor: colors.hover
    },
    '& .MuiInputBase-input': {
        padding: 0,
        height: '22px',
        '&:focus': {
            outline: 'none'
        }
    }
}));

// Add styled component for select
const StyledSelect = styled('select')(({ theme }) => ({
    height: '24px',
    fontSize: '0.7rem',
    padding: '0 8px',
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    color: theme.palette.text.primary,
    outline: 'none',
    transition: 'all 0.2s',
    '&:focus': {
        borderColor: colors.accent,
        outline: 'none',  // Remove default outline
        boxShadow: `0 0 0 1px ${colors.accent}`  // Add single red outline
    },
    '&:hover': {
        borderColor: colors.hover
    }
}));

// Utility functions for sorting and filtering
const normalizeResolution = (resolution) => {
    // Convert resolution to total pixels for comparison
    if (!resolution || !Array.isArray(resolution)) return 0;
    return resolution[0] * resolution[1];
};

const getFilteredAssets = (assets, searchQuery, fileTypeFilter, sortBy, sortDirection) => {
    if (!Array.isArray(assets)) return [];
    
    return assets
        .filter(asset => 
            (!fileTypeFilter || fileTypeFilter === 'all' || asset.format === fileTypeFilter) &&
            (!searchQuery?.trim() || asset.title?.toLowerCase().includes(searchQuery.toLowerCase()))
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
                    // Compare file sizes numerically
                    const sizeA = parseFloat(a.file_size) || 0;
                    const sizeB = parseFloat(b.file_size) || 0;
                    comparison = sizeA - sizeB;
                    break;
                case 'fps': 
                    // Normalize FPS values for comparison
                    const fpsA = parseFloat(a.fps) || 0;
                    const fpsB = parseFloat(b.fps) || 0;
                    comparison = fpsA - fpsB;
                    break;
                case 'resolution':
                    // Compare total pixels for resolution
                    const resA = a.width * a.height || 0;
                    const resB = b.width * b.height || 0;
                    comparison = resA - resB;
                    break;
                case 'format':
                    // Compare file formats
                    const formatA = a.file_path?.split('.').pop()?.toUpperCase() || '';
                    const formatB = b.file_path?.split('.').pop()?.toUpperCase() || '';
                    comparison = formatA.localeCompare(formatB);
                    break;
                default: 
                    comparison = 0;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
};

// Error boundary for MediaLibrary component
class MediaLibraryErrorBoundary extends React.Component {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    render() {
        if (this.state.hasError) {
            return (
                <Box sx={{ p: 3, textAlign: 'center', color: 'error.main' }}>
                    <h3>Failed to load media library</h3>
                    <button onClick={() => window.location.reload()} sx={{
                        padding: '8px 16px',
                        backgroundColor: 'primary.main',
                        color: 'common.white',
                        border: 'none',
                        borderRadius: 1,
                        cursor: 'pointer'
                    }}>
                        Retry
                    </button>
                </Box>
            );
        }
        return this.props.children;
    }
}

// Helper function to get sort options from assets
const getSortOptions = (assets = []) => {
    // Always include these basic options
    const options = new Set(['title', 'format']);  // Added 'format' as a default option
    if (!Array.isArray(assets)) return Array.from(options);
    
    assets.forEach(asset => {
        if (asset.duration) options.add('duration');
        if (asset.width && asset.height) options.add('resolution');
        if (asset.fps) options.add('fps');
        if (asset.file_size) options.add('size');
    });
    return Array.from(options);
};

// Main MediaLibrary component
const MediaLibrary = ({ 
    assets = [],
    loading = false,
    error = null,
    viewMode = 'grid',
    setViewMode,
    sortBy = 'title',
    setSortBy,
    sortDirection = 'asc',
    setSortDirection,
    searchQuery = '',
    setSearchQuery,
    setShowDirectoryManager,
    filteredAssets = []
}) => {
    const navigate = useNavigate();
    const theme = useTheme();
    const sortOptions = getSortOptions(assets);

    // Memoize filtered assets to prevent unnecessary re-renders
    const displayedAssets = useMemo(() => {
        if (!Array.isArray(assets)) return [];
        return getFilteredAssets(assets, searchQuery, null, sortBy, sortDirection);
    }, [assets, searchQuery, sortBy, sortDirection]);

    // Handle scan click
    const handleScan = async () => {
        try {
            const response = await fetch(`${config.api.baseURL}/scan`, {
                method: 'POST'
            });
            if (!response.ok) throw new Error('Scan failed');
            // Refresh will happen through WebSocket update
        } catch (error) {
            console.error('Scan failed:', error);
        }
    };

    return (
        <MediaLibraryErrorBoundary>
            <Box sx={{ maxWidth: '1400px', margin: '0 auto' }}>
                {/* Search and filters */}
                <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                        <SearchInput
                            value={searchQuery}
                            onChange={e => setSearchQuery?.(e.target.value)}
                            placeholder="Search media assets..."
                            fullWidth
                        />
                        <StyledSelect 
                            value={sortBy}
                            onChange={(e) => setSortBy?.(e.target.value)}
                        >
                            {sortOptions.map(option => (
                                <option key={option} value={option}>
                                    Sort by: {option.charAt(0).toUpperCase() + option.slice(1)}
                                </option>
                            ))}
                        </StyledSelect>
                        
                        {/* Sort direction toggle */}
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <button
                                onClick={() => setSortDirection?.('asc')}
                                style={{
                                    padding: '4px 8px',
                                    height: '24px',
                                    backgroundColor: 'transparent',
                                    color: theme.palette.text.primary,
                                    border: '1px solid',
                                    borderColor: sortDirection === 'asc' ? theme.palette.primary.main : theme.palette.divider,
                                    borderRadius: theme.shape.borderRadius,
                                    cursor: 'pointer',
                                    fontSize: '0.7rem',
                                    fontFamily: theme.typography.fontFamily
                                }}
                            >
                                Asc
                            </button>
                            <button
                                onClick={() => setSortDirection?.('desc')}
                                style={{
                                    padding: '4px 8px',
                                    height: '24px',
                                    backgroundColor: 'transparent',
                                    color: theme.palette.text.primary,
                                    border: '1px solid',
                                    borderColor: sortDirection === 'desc' ? theme.palette.primary.main : theme.palette.divider,
                                    borderRadius: theme.shape.borderRadius,
                                    cursor: 'pointer',
                                    fontSize: '0.7rem',
                                    fontFamily: theme.typography.fontFamily
                                }}
                            >
                                Desc
                            </button>
                        </Box>
                        <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                    </Box>

                    {/* Error display */}
                    {error && (
                        <Box sx={{ color: 'error.main', mb: 2 }}>
                            {error}
                        </Box>
                    )}

                    {/* Content display */}
                    {viewMode === 'grid' ? (
                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                            gap: 2,
                            p: 2
                        }}>
                            {displayedAssets.map((asset) => (
                                <AssetCard 
                                    key={asset.id} 
                                    asset={asset}
                                    onClick={() => navigate(`/asset/${asset.id}`, { state: { asset } })}
                                />
                            ))}
                        </Box>
                    ) : (
                        <ListView 
                            assets={displayedAssets} 
                            navigate={navigate}
                            sortBy={sortBy}
                            setSortBy={setSortBy}
                            sortDirection={sortDirection}
                            setSortDirection={setSortDirection}
                        />
                    )}

                    {/* Loading and empty states */}
                    {loading && (
                        <Box sx={{ textAlign: 'center', p: 3 }}>
                            <CircularProgress />
                        </Box>
                    )}

                    {!loading && displayedAssets.length === 0 && (
                        <Box sx={{ textAlign: 'center', p: 3, color: 'text.secondary' }}>
                            {searchQuery.trim() ? 'No matching assets found' : 'No assets found'}
                        </Box>
                    )}
                </Box>
            </Box>
        </MediaLibraryErrorBoundary>
    );
};

export default MediaLibrary; 