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
        padding: '4px 8px', // Reduced vertical padding
        backgroundColor: 'transparent',
        border: '1px solid',
        borderRadius: config.theme.radius.sm,
        cursor: 'pointer',
        fontSize: '0.7rem',
        transition: 'all 0.2s ease',
        color: config.theme.colors.text.primary,
        fontFamily: config.theme.typography.fontFamily.base
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
                    borderColor: viewMode === 'grid' ? config.theme.colors.accent : config.theme.colors.border,
                }}
            >
                Grid
            </button>
            <button
                onClick={() => setViewMode('list')}
                style={{
                    ...styles.button,
                    borderColor: viewMode === 'list' ? config.theme.colors.accent : config.theme.colors.border,
                }}
            >
                List
            </button>
        </div>
    );
};

export default ViewToggle; 