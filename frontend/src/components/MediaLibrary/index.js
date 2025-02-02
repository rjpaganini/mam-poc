import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import config from '../../config';
import { AssetCard } from './AssetCard';
import { ListView } from './ListView';
import { ViewToggle } from './ViewToggle';

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
    }
};

// Main MediaLibrary component
export const MediaLibrary = ({ 
    assets,
    loading,
    error,
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
    searchQuery,
    setSearchQuery,
    setShowDirectoryManager,
    filteredAssets
}) => {
    const navigate = useNavigate();
    const sortOptions = getSortOptions(assets);

    return (
        <MediaLibraryErrorBoundary>
            <div style={styles.container}>
                {/* Header */}
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2
                }}>
                    <h1 style={{ color: config.theme.colors.primary, margin: 0 }}>
                        valn.io
                    </h1>
                    <button
                        onClick={() => setShowDirectoryManager(true)}
                        style={styles.button}
                    >
                        🔍 Scan Media
                    </button>
                </Box>

                {/* Search and filters */}
                <div style={styles.searchSection}>
                    <div style={styles.filterBar}>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search media assets..."
                            style={{
                                ...styles.input,
                                minWidth: '200px',
                                flex: '1 1 auto'
                            }}
                        />
                        <select 
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            style={styles.select}
                        >
                            {sortOptions.map(option => (
                                <option key={option} value={option}>
                                    Sort by: {option.charAt(0).toUpperCase() + option.slice(1)}
                                </option>
                            ))}
                        </select>
                        
                        {/* Sort controls */}
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                                onClick={() => setSortDirection('asc')}
                                style={{
                                    ...styles.button,
                                    background: sortDirection === 'asc' ? config.theme.colors.primary : 'transparent'
                                }}
                            >
                                ↑ Asc
                            </button>
                            <button
                                onClick={() => setSortDirection('desc')}
                                style={{
                                    ...styles.button,
                                    background: sortDirection === 'desc' ? config.theme.colors.primary : 'transparent'
                                }}
                            >
                                ↓ Desc
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
                            {filteredAssets.map((asset) => (
                                <AssetCard 
                                    key={asset.id} 
                                    asset={asset}
                                    onClick={() => navigate(`/asset/${asset.id}`, { state: { asset } })}
                                />
                            ))}
                        </div>
                    ) : (
                        <ListView assets={filteredAssets} navigate={navigate} />
                    )}

                    {/* Loading and empty states */}
                    {loading && (
                        <Box sx={{ textAlign: 'center', p: 3 }}>
                            <CircularProgress />
                        </Box>
                    )}

                    {!loading && assets.length === 0 && (
                        <Box sx={{ textAlign: 'center', p: 3, color: 'text.secondary' }}>
                            No assets found
                        </Box>
                    )}
                </div>
            </div>
        </MediaLibraryErrorBoundary>
    );
};

// Helper function to get sort options from assets
const getSortOptions = (assets) => {
    const options = new Set(['title']);
    assets.forEach(asset => {
        if (asset.media_metadata) {
            if (asset.media_metadata.duration) options.add('duration');
            if (asset.media_metadata.resolution) options.add('resolution');
            if (asset.media_metadata.fps) options.add('fps');
            if (asset.media_metadata.file_size) options.add('size');
        }
    });
    return Array.from(options);
};

export default MediaLibrary; 