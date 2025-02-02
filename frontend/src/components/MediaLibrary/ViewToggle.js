import React from 'react';
import config from '../../config';

// Styles for view toggle buttons
const styles = {
    container: {
        display: 'flex',
        gap: config.theme.spacing.sm,
        marginLeft: 'auto'
    },
    button: {
        padding: config.theme.spacing.sm,
        border: `1px solid ${config.theme.colors.border}`,
        borderRadius: config.theme.radius.sm,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
    }
};

// ViewToggle component for switching between grid and list views
export const ViewToggle = ({ viewMode, setViewMode }) => {
    return (
        <div style={styles.container}>
            <button
                onClick={() => setViewMode('grid')}
                style={{
                    ...styles.button,
                    background: viewMode === 'grid' ? config.theme.colors.primary : 'transparent',
                    color: viewMode === 'grid' ? '#fff' : config.theme.colors.text.primary
                }}
            >
                📱 Grid
            </button>
            <button
                onClick={() => setViewMode('list')}
                style={{
                    ...styles.button,
                    background: viewMode === 'list' ? config.theme.colors.primary : 'transparent',
                    color: viewMode === 'list' ? '#fff' : config.theme.colors.text.primary
                }}
            >
                📋 List
            </button>
        </div>
    );
};

export default ViewToggle; 