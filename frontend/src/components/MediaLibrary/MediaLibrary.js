import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import config from '../../config';
import { AssetCard } from './AssetCard';
import { ListView } from './ListView';
import { ViewToggle } from './ViewToggle';

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
                <Box sx={{ p: 3, textAlign: 'center', color: config.theme.colors.error }}>
                    <h3>Failed to load media library</h3>
                    <button onClick={() => window.location.reload()} style={styles.button}>
                        Retry
                    </button>
                </Box>
            );
        }
        return this.props.children;
    }
}

// Styles object for MediaLibrary
const styles = {
    container: {
        maxWidth: '1400px',
        margin: '0 auto'
    },
    button: {
        padding: `${config.theme.spacing.sm} ${config.theme.spacing.md}`,
        backgroundColor: config.theme.colors.primary,
        color: '#fff',
        border: 'none',
        borderRadius: config.theme.radius.md,
        cursor: 'pointer'
    },
    input: {
        padding: '8px 12px',
        border: '1px solid #404040',
        borderRadius: '4px',
        backgroundColor: '#2d2d2d',
        color: '#ffffff',
        fontSize: '16px'
    },
    searchSection: {
        marginBottom: config.theme.spacing.lg
    },
    filterBar: {
        display: 'flex',
        gap: config.theme.spacing.md,
        alignItems: 'center'
    },
    select: {
        padding: config.theme.spacing.sm,
        borderRadius: config.theme.radius.sm,
        border: `1px solid ${config.theme.colors.border}`,
        backgroundColor: config.theme.colors.surface,
        color: config.theme.colors.text.primary
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: config.theme.spacing.lg,
        padding: config.theme.spacing.md
    }
};

// Helper function to get sort options from assets
const getSortOptions = (assets = []) => {
    const options = new Set(['title']);
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
    const sortOptions = getSortOptions(assets);

    // Memoize filtered assets to prevent unnecessary re-renders
    const displayedAssets = useMemo(() => {
        if (!Array.isArray(assets)) return [];
        return getFilteredAssets(assets, searchQuery, null, sortBy, sortDirection);
    }, [assets, searchQuery, sortBy, sortDirection]);

    return (
        <MediaLibraryErrorBoundary>
            <div style={styles.container}>
                {/* Search and filters */}
                <div style={styles.searchSection}>
                    <div style={styles.filterBar}>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery?.(e.target.value)}
                            placeholder="Search media assets..."
                            style={{
                                ...styles.input,
                                minWidth: '200px',
                                flex: '1 1 auto',
                                height: '24px',
                                fontSize: '0.7rem',
                                padding: '0 8px'
                            }}
                        />
                        <select 
                            value={sortBy}
                            onChange={(e) => setSortBy?.(e.target.value)}
                            style={{
                                ...styles.select,
                                height: '24px',
                                fontSize: '0.7rem',
                                padding: '0 8px'
                            }}
                        >
                            {sortOptions.map(option => (
                                <option key={option} value={option}>
                                    Sort by: {option.charAt(0).toUpperCase() + option.slice(1)}
                                </option>
                            ))}
                        </select>
                        
                        {/* Sort direction toggle */}
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                                onClick={() => setSortDirection?.('asc')}
                                style={{
                                    padding: '4px 8px',
                                    height: '24px',
                                    backgroundColor: 'transparent',
                                    color: config.theme.colors.text.primary,
                                    border: '1px solid',
                                    borderColor: sortDirection === 'asc' ? config.theme.colors.accent : config.theme.colors.border,
                                    borderRadius: config.theme.radius.sm,
                                    cursor: 'pointer',
                                    fontSize: '0.7rem',
                                    fontFamily: config.theme.typography.fontFamily.base
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
                                    color: config.theme.colors.text.primary,
                                    border: '1px solid',
                                    borderColor: sortDirection === 'desc' ? config.theme.colors.accent : config.theme.colors.border,
                                    borderRadius: config.theme.radius.sm,
                                    cursor: 'pointer',
                                    fontSize: '0.7rem',
                                    fontFamily: config.theme.typography.fontFamily.base
                                }}
                            >
                                Desc
                            </button>
                        </div>
                        <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                    </div>

                    {/* Error display */}
                    {error && (
                        <div style={{ color: config.theme.colors.error, mb: 2 }}>
                            {error}
                        </div>
                    )}

                    {/* Content display */}
                    {viewMode === 'grid' ? (
                        <div style={styles.grid}>
                            {displayedAssets.map((asset) => (
                                <AssetCard 
                                    key={asset.id} 
                                    asset={asset}
                                    onClick={() => navigate(`/asset/${asset.id}`, { state: { asset } })}
                                />
                            ))}
                        </div>
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
                </div>
            </div>
        </MediaLibraryErrorBoundary>
    );
};

export default MediaLibrary; 