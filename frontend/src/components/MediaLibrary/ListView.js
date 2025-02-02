import React from 'react';
import { Box } from '@mui/material';
import config from '../../config';
import { formatFileSize } from '../../utils/formatters';

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

// Styles for the list view
const styles = {
    list: {
        backgroundColor: config.theme.colors.surface,
        borderRadius: config.theme.radius.lg,
        overflow: 'hidden',
        border: `1px solid ${config.theme.colors.border}`
    },
    header: {
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
        gap: config.theme.spacing.md,
        padding: config.theme.spacing.md,
        backgroundColor: config.theme.colors.background,
        borderBottom: `1px solid ${config.theme.colors.border}`,
        fontWeight: config.theme.fontWeight.bold
    },
    row: {
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
        gap: config.theme.spacing.md,
        padding: config.theme.spacing.md,
        borderBottom: `1px solid ${config.theme.colors.border}`,
        cursor: 'pointer',
        '&:hover': {
            backgroundColor: config.theme.colors.background
        }
    }
};

// Main ListView component
export const ListView = ({ assets, navigate }) => {
    return (
        <ListViewErrorBoundary>
            <div style={styles.list}>
                {/* Header */}
                <div style={styles.header}>
                    <div>Title</div>
                    <div>Duration</div>
                    <div>Resolution</div>
                    <div>FPS</div>
                    <div>Size</div>
                </div>

                {/* Rows */}
                {assets.map(asset => (
                    <div
                        key={asset.id}
                        style={styles.row}
                        onClick={() => navigate(`/asset/${asset.id}`, { state: { asset } })}
                    >
                        <div style={{ color: config.theme.colors.text.primary }}>
                            {asset.title}
                        </div>
                        <div style={{ color: config.theme.colors.text.secondary }}>
                            {asset.media_metadata?.duration ? 
                                `${Math.round(asset.media_metadata.duration)}s` : '-'}
                        </div>
                        <div style={{ color: config.theme.colors.text.secondary }}>
                            {asset.media_metadata?.resolution ? 
                                asset.media_metadata.resolution.join('×') : '-'}
                        </div>
                        <div style={{ color: config.theme.colors.text.secondary }}>
                            {asset.media_metadata?.fps ? 
                                Number(asset.media_metadata.fps).toFixed(2) : '-'}
                        </div>
                        <div style={{ color: config.theme.colors.text.secondary }}>
                            {asset.media_metadata?.file_size ? 
                                formatFileSize(asset.media_metadata.file_size) : '-'}
                        </div>
                    </div>
                ))}
            </div>
        </ListViewErrorBoundary>
    );
};

export default ListView; 