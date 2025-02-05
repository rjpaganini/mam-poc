import React from 'react';
import { Box } from '@mui/material';
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import config from '../../config';
import { formatFileSize, formatDuration, formatFPS, formatBitrate } from '../../utils/formatters';

// Define columns for the data grid
export const columns = [
    {
        field: 'title',
        headerName: 'Title',
        flex: 2,
        minWidth: 200,
        sortable: true,
        valueGetter: (params) => params.row.title || '-'
    },
    {
        field: 'resolution',
        headerName: 'Resolution',
        width: 120,
        sortable: true,
        valueGetter: (params) => {
            const metadata = params.row.media_metadata;
            return metadata?.width && metadata?.height ? 
                `${metadata.width}×${metadata.height}` : '-';
        }
    },
    {
        field: 'duration',
        headerName: 'Duration',
        width: 100,
        sortable: true,
        valueGetter: (params) => params.row.media_metadata?.duration || 0,
        valueFormatter: (params) => formatDuration(params.value)
    },
    {
        field: 'codec',
        headerName: 'Codec',
        width: 80,
        sortable: true,
        valueGetter: (params) => params.row.media_metadata?.codec || '-',
        valueFormatter: (params) => params.value.toString().toUpperCase()
    },
    {
        field: 'format',
        headerName: 'Format',
        width: 80,
        sortable: true,
        valueGetter: (params) => {
            const filePath = params.row.file_path;
            return filePath ? filePath.split('.').pop().toUpperCase() : '-';
        }
    },
    {
        field: 'fps',
        headerName: 'FPS',
        width: 70,
        sortable: true,
        valueGetter: (params) => params.row.media_metadata?.fps || 0,
        valueFormatter: (params) => formatFPS(params.value)
    },
    {
        field: 'file_size',
        headerName: 'Size',
        width: 90,
        sortable: true,
        valueGetter: (params) => {
            // Get file_size from root level of asset
            const size = params.row.file_size;
            return typeof size === 'number' ? size : 0;
        },
        valueFormatter: (params) => formatFileSize(params.value)
    },
    {
        field: 'bitrate',
        headerName: 'Bitrate',
        width: 100,
        sortable: true,
        valueGetter: (params) => params.row.media_metadata?.bitrate || 0,
        valueFormatter: (params) => formatBitrate(params.value)
    }
];

// Error boundary for list view
class ListViewErrorBoundary extends React.Component {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    render() {
        if (this.state.hasError) {
            return (
                <Box sx={{ p: 2, color: 'error.main' }}>
                    Failed to load list view
                </Box>
            );
        }
        return this.props.children;
    }
}

// Styles with safe theme access
const styles = {
    container: {
        width: '100%',
        backgroundColor: config.theme.colors.surface,
        borderRadius: config.theme.radius.lg,
        overflow: 'hidden',
        border: `1px solid ${config.theme.colors.border}`
    },
    header: {
        display: 'flex',
        borderBottom: `1px solid ${config.theme.colors.border}`,
        backgroundColor: config.theme.colors.background,
        fontFamily: config.theme.typography.fontFamily.base
    },
    headerCell: {
        padding: '8px 12px',
        color: config.theme.colors.text.secondary,
        fontSize: config.theme.typography.fontSize.sm,
        fontWeight: config.theme.typography.fontWeight.medium,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'color 0.2s ease',
        '&:hover': {
            color: config.theme.colors.text.primary
        }
    },
    row: {
        display: 'flex',
        borderBottom: `1px solid ${config.theme.colors.border}`,
        transition: 'background-color 0.2s ease',
        cursor: 'pointer',
        '&:hover': {
            backgroundColor: config.theme.colors.hover
        },
        fontFamily: config.theme.typography.fontFamily.base
    },
    cell: {
        padding: '8px 12px',
        color: config.theme.colors.text.primary,
        fontSize: config.theme.typography.fontSize.sm,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis'
    },
    sortIcon: {
        display: 'flex',
        alignItems: 'center',
        fontSize: config.theme.typography.fontSize.sm,
        marginLeft: '4px'
    }
};

// Main ListView component
const ListView = ({ 
    assets, 
    navigate, 
    sortBy, 
    setSortBy, 
    sortDirection, 
    setSortDirection 
}) => {
    // Handle column header click for sorting
    const handleSort = (field) => {
        if (sortBy === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortDirection('asc');
        }
    };

    // Sort assets based on current sort settings
    const sortedAssets = React.useMemo(() => {
        if (!sortBy) return assets;

        const column = columns.find(col => col.field === sortBy);
        if (!column) return assets;

        return [...assets].sort((a, b) => {
            let aValue = column.valueGetter ? column.valueGetter({ row: a }) : a[sortBy];
            let bValue = column.valueGetter ? column.valueGetter({ row: b }) : b[sortBy];

            // Handle numeric comparison for file size
            if (sortBy === 'file_size') {
                aValue = typeof aValue === 'number' ? aValue : 0;
                bValue = typeof bValue === 'number' ? bValue : 0;
                return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            }

            // Handle formatting if needed
            if (column.valueFormatter) {
                aValue = column.valueFormatter({ value: aValue });
                bValue = column.valueFormatter({ value: bValue });
            }

            // Handle string comparison
            if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }

            // Handle numeric comparison
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            }

            // Default string comparison
            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [assets, sortBy, sortDirection]);

    // Get cell value based on column definition
    const getCellValue = (asset, column) => {
        let value = column.valueGetter ? column.valueGetter({ row: asset }) : asset[column.field];
        if (column.valueFormatter) {
            value = column.valueFormatter({ value });
        }
        return value || '-';
    };

    // Render sort icon based on current sort state
    const renderSortIcon = (field) => {
        if (sortBy !== field) return <FaSort style={styles.sortIcon} />;
        return sortDirection === 'asc' ? 
            <FaSortUp style={styles.sortIcon} /> : 
            <FaSortDown style={styles.sortIcon} />;
    };

    return (
        <ListViewErrorBoundary>
            <Box sx={styles.container}>
                {/* Header */}
                <Box sx={styles.header}>
                    {columns.map((column) => (
                        <Box
                            key={column.field}
                            sx={{
                                ...styles.headerCell,
                                width: column.width || 'auto',
                                flex: column.flex || 'none',
                                minWidth: column.minWidth
                            }}
                            onClick={() => handleSort(column.field)}
                        >
                            {column.headerName}
                            {renderSortIcon(column.field)}
                        </Box>
                    ))}
                </Box>

                {/* Rows */}
                {sortedAssets.map((asset) => (
                    <Box
                        key={asset.id}
                        sx={styles.row}
                        onClick={() => navigate(`/asset/${asset.id}`)}
                    >
                        {columns.map((column) => (
                            <Box
                                key={column.field}
                                sx={{
                                    ...styles.cell,
                                    width: column.width || 'auto',
                                    flex: column.flex || 'none',
                                    minWidth: column.minWidth
                                }}
                            >
                                {getCellValue(asset, column)}
                            </Box>
                        ))}
                    </Box>
                ))}

                {/* Empty state */}
                {assets.length === 0 && (
                    <div style={{
                        padding: config.theme.spacing.xl,
                        textAlign: 'center',
                        color: config.theme.colors.text.secondary
                    }}>
                        No assets found
                    </div>
                )}
            </Box>
        </ListViewErrorBoundary>
    );
};

// Export both named and default exports
export { ListView };
export default ListView; 