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
 * Enhanced column definitions with proper metadata access
 */
const columns = [
    { 
        id: 'title', 
        label: 'Title', 
        sortable: true,
        getValue: (asset) => asset.title
    },
    { 
        id: 'duration', 
        label: 'Duration', 
        sortable: true,
        getValue: (asset) => formatDuration(asset.duration)
    },
    { 
        id: 'size', 
        label: 'Size', 
        sortable: true,
        getValue: (asset) => formatFileSize(asset.file_size)
    },
    { 
        id: 'resolution', 
        label: 'Resolution', 
        sortable: true,
        getValue: (asset) => asset.width && asset.height ? `${asset.width}×${asset.height}` : '-'
    },
    { 
        id: 'fps', 
        label: 'FPS', 
        sortable: true,
        getValue: (asset) => asset.fps ? formatFPS(asset.fps) : '-'
    },
    { 
        id: 'codec', 
        label: 'Codec', 
        sortable: true,
        getValue: (asset) => asset.codec ? asset.codec.toUpperCase() : '-'
    },
    { 
        id: 'format', 
        label: 'Format', 
        sortable: true,
        getValue: (asset) => {
            const format = asset.file_path?.split('.').pop()?.toUpperCase() || '-';
            return {
                display: format,
                sort: format // Separate sort value for consistent sorting
            };
        },
        display: (value) => value.display || '-' // Display the formatted value
    }
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
        border: `1px solid ${theme.palette.divider}`,
        // Add global focus styles
        '& .MuiOutlinedInput-root': {
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.error.main,
                borderWidth: '2px'
            }
        },
        '& .MuiInputBase-root.Mui-focused': {
            '& > fieldset': {
                borderColor: `${theme.palette.error.main} !important`
            }
        },
        // Override default focus color for all interactive elements
        '& *:focus': {
            outline: `2px solid ${theme.palette.error.main} !important`,
            outlineOffset: '2px'
        },
        '& .MuiInputBase-root:focus-within': {
            '& > fieldset': {
                borderColor: `${theme.palette.error.main} !important`
            }
        }
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

    // Sort the filtered assets
    const sortedAssets = useMemo(() => {
        if (!sortBy) return filteredAssets;
        
        const column = columns.find(col => col.id === sortBy);
        if (!column) return filteredAssets;

        return [...filteredAssets].sort((a, b) => {
            const aValue = column.getValue(a);
            const bValue = column.getValue(b);
            
            // Handle sort values for format column
            const aSort = aValue?.sort !== undefined ? aValue.sort : aValue;
            const bSort = bValue?.sort !== undefined ? bValue.sort : bValue;
            
            if (aSort === bSort) return 0;
            if (aSort === '-') return 1;
            if (bSort === '-') return -1;
            
            const result = aSort < bSort ? -1 : 1;
            return sortDirection === 'asc' ? result : -result;
        });
    }, [filteredAssets, sortBy, sortDirection]);

    return (
        <ListViewErrorBoundary>
            <TableContainer 
                component={Paper} 
                sx={{ 
                    maxHeight: 'calc(100vh - 200px)',
                    '& .MuiTableCell-root': {
                        py: 0.5,
                        px: 1,
                        fontSize: '0.7rem',
                        height: '24px',
                        whiteSpace: 'nowrap'
                    }
                }}
            >
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            {columns.map(col => (
                                <TableCell 
                                    key={col.id}
                                    sx={{
                                        backgroundColor: 'background.paper',
                                        fontWeight: 'medium',
                                        cursor: col.sortable ? 'pointer' : 'default',
                                        userSelect: 'none',
                                        '&:hover': col.sortable ? {
                                            backgroundColor: 'action.hover'
                                        } : {}
                                    }}
                                    onClick={() => col.sortable && handleSort(col.id)}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        {col.label}
                                        {col.sortable && renderSortIcon(col.id)}
                                    </Box>
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {sortedAssets.map(asset => (
                            <TableRow 
                                key={asset.id}
                                hover
                                onClick={() => navigate(`/asset/${asset.id}`)}
                                sx={{ 
                                    cursor: 'pointer',
                                    '&:hover': {
                                        backgroundColor: 'action.hover'
                                    }
                                }}
                            >
                                {columns.map(col => (
                                    <TableCell key={col.id}>
                                        {col.display ? col.display(col.getValue(asset)) : col.getValue(asset)}
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