import React from 'react';
import { Box, Button, styled } from '@mui/material';

// Styled components using MUI's system
const ToggleButton = styled(Button)(({ theme }) => ({
    padding: '4px 8px',
    backgroundColor: 'transparent',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    cursor: 'pointer',
    fontSize: '0.7rem',
    transition: 'all 0.2s ease',
    color: theme.palette.text.primary,
    fontFamily: theme.typography.fontFamily,
    '&.active': {
        borderColor: theme.palette.primary.main
    },
    '&:hover': {
        backgroundColor: theme.palette.action.hover
    }
}));

// ViewToggle component for switching between grid and list views
export const ViewToggle = ({ viewMode, setViewMode }) => {
    return (
        <Box sx={{ display: 'flex', gap: 1, marginLeft: 'auto' }}>
            <ToggleButton
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'active' : ''}
                variant="outlined"
                size="small"
            >
                Grid
            </ToggleButton>
            <ToggleButton
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'active' : ''}
                variant="outlined"
                size="small"
            >
                List
            </ToggleButton>
        </Box>
    );
};

export default ViewToggle; 