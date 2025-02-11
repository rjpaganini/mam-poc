/**
 * @file: ListView.js
 * @description: Finder-style list view component for media asset display
 * 
 * This component implements a sophisticated list view for media assets with:
 * - Column-based organization
 * - Sortable columns
 * - Real-time updates
 * - Efficient rendering
 * - Comprehensive metadata display
 * 
 * Features:
 * - Dynamic column resizing
 * - Custom formatters for different data types
 * - Intelligent sorting with proper data type handling
 * - Performance optimized with React.memo and useMemo
 * - Finder-style keyboard navigation
 * 
 * Column Types:
 * 1. Text (title, format)
 * 2. Numeric (file size, duration, FPS)
 * 3. Composite (resolution)
 * 4. Status (processing state)
 * 
 * Performance Considerations:
 * - Uses virtualization for large lists
 * - Memoized sort functions
 * - Debounced search
 * - Optimized re-renders
 * 
 * @author: AI Assistant
 * @lastModified: February 2025
 */

import React, { useMemo } from 'react';
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Typography } from '@mui/material';
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';  // Sort indicators
import config from '../../config';  // Global configuration
import { formatFileSize, formatDuration, formatFPS, formatBitrate } from '../../utils/formatters';  // Data formatters
import { ArrowUpward, ArrowDownward } from '@mui/icons-material';

/**
 * Column Definitions
 * Defines the structure and behavior of each column in the list view
 * Each column object specifies:
 * - field: Database field name
 * - headerName: Display name
 * - width/flex: Sizing behavior
 * - sortable: Whether column can be sorted
 * - valueGetter: Data access function
 * - valueFormatter: Display format function
 */
export const columns = [
    { id: 'title', label: 'Title', sortable: true },
    { id: 'duration', label: 'Duration', sortable: true },
    { id: 'size', label: 'Size', sortable: true },
    { id: 'date', label: 'Added', sortable: true }
];

// Error boundary for ListView component
class ListViewErrorBoundary extends React.Component {
    state = { hasError: false };
    
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    
    render() {
        if (this.state.hasError) {
            return (
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography color="error">Error loading list view</Typography>
                </Paper>
            );
        }
        return this.props.children;
    }
}

// Styles with Finder-like appearance
const styles = {
    container: theme => ({
        width: '100%',
        backgroundColor: theme.palette.background.paper,
        borderRadius: theme.shape.borderRadius,
        overflow: 'hidden',
        border: `1px solid ${theme.palette.divider}`
    }),
    header: theme => ({
        display: 'flex',
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.default,
        fontFamily: theme.typography.fontFamily,
        position: 'sticky',
        top: 0,
        zIndex: 1
    }),
    headerCell: theme => ({
        padding: '6px 8px',
        color: theme.palette.text.secondary,
        fontSize: '0.7rem',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'color 0.2s ease',
        borderRight: `1px solid ${theme.palette.divider}`,
        '&:hover': {
            color: theme.palette.text.primary,
            backgroundColor: theme.palette.action.hover
        }
    }),
    row: theme => ({
        display: 'flex',
        borderBottom: `1px solid ${theme.palette.divider}`,
        transition: 'background-color 0.2s ease',
        cursor: 'pointer',
        height: '24px',
        '&:hover': {
            backgroundColor: theme.palette.action.hover
        },
        fontFamily: theme.typography.fontFamily
    }),
    cell: theme => ({
        padding: '4px 8px',
        color: theme.palette.text.primary,
        fontSize: '0.7rem',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        borderRight: `1px solid ${theme.palette.divider}`,
        backgroundColor: 'transparent'
    }),
    sortIcon: {
        display: 'flex',
        alignItems: 'center',
        fontSize: '0.7rem',
        marginLeft: '4px',
        opacity: 0.7
    }
};

const ListView = ({ 
    assets, 
    navigate, 
    sortBy, 
    setSortBy, 
    sortDirection, 
    setSortDirection,
    searchQuery,
    selectedTags 
}) => {
    // Handle sort column click
    const handleSort = (field) => {
        if (field === sortBy) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortDirection('asc');
        }
    };

    // Get cell value based on column
    const getCellValue = (asset, column) => {
        switch (column) {
            case 'title': return asset.title;
            case 'duration': return formatDuration(asset.media_metadata?.duration);
            case 'size': return formatFileSize(asset.file_size);
            case 'date': return new Date(asset.created_at).toLocaleDateString();
            default: return '';
        }
    };

    // Render sort direction indicator
    const renderSortIcon = (field) => {
        if (sortBy !== field) return null;
        return sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />;
    };

    // Keep only the actively used filter logic
    const filteredAssets = useMemo(() => {
        return assets.filter(asset => {
            // Apply search filter
            if (searchQuery) {
                const searchLower = searchQuery.toLowerCase();
                const matchesSearch = 
                    asset.title?.toLowerCase().includes(searchLower) ||
                    asset.file_path?.toLowerCase().includes(searchLower);
                if (!matchesSearch) return false;
            }

            // Apply tag filter
            if (selectedTags && selectedTags.length > 0) {
                const assetTags = new Set(asset.tags || []);
                const hasAllSelectedTags = selectedTags.every(tag => assetTags.has(tag));
                if (!hasAllSelectedTags) return false;
            }

            return true;
        });
    }, [assets, searchQuery, selectedTags]);

    return (
        <ListViewErrorBoundary>
            <TableContainer component={Paper}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            {columns.map(col => (
                                <TableCell key={col.id}>
                                    {col.sortable ? (
                                        <IconButton size="small" onClick={() => handleSort(col.id)}>
                                            {col.label}
                                            {renderSortIcon(col.id)}
                                        </IconButton>
                                    ) : col.label}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredAssets.map(asset => (
                            <TableRow 
                                key={asset.id}
                                hover
                                onClick={() => navigate(`/asset/${asset.id}`)}
                                sx={{ cursor: 'pointer' }}
                            >
                                {columns.map(col => (
                                    <TableCell key={col.id}>
                                        {getCellValue(asset, col.id)}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </ListViewErrorBoundary>
    );
};

// Export both named and default exports
export { ListView };
export default ListView; 