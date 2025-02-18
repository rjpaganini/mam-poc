import React from 'react';
import { Box, Button, Tooltip } from '@mui/material';
import config from '../config';
import { FaSync, FaChartLine } from 'react-icons/fa';
import { Link, useLocation } from 'react-router-dom';

const Header = ({ onScanClick }) => {
    const location = useLocation();
    const isMetricsPage = location.pathname === '/metrics';

    return (
        <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: config.theme.spacing.md,
            backgroundColor: config.theme.colors.surface,
            borderBottom: `1px solid ${config.theme.colors.border}`,
            position: 'sticky',
            top: 0,
            zIndex: 1000
        }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <h1 style={{ 
                    color: config.theme.colors.text.primary, 
                    margin: 0,
                    fontSize: config.theme.fontSize.lg,
                    fontWeight: config.theme.fontWeight.bold
                }}>
                    valn.io
                </h1>
            </Box>
            
            {/* Scan Media Button - Always visible */}
            <Button
                onClick={onScanClick}
                startIcon={<FaSync />}
                variant="contained"
                sx={{
                    backgroundColor: config.theme.colors.primary,
                    color: config.theme.colors.text.primary,
                    '&:hover': {
                        backgroundColor: config.theme.colors.primaryDark
                    },
                    padding: `${config.theme.spacing.sm} ${config.theme.spacing.md}`,
                    borderRadius: config.theme.radius.sm,
                    textTransform: 'none',
                    fontWeight: config.theme.fontWeight.medium,
                    display: 'flex',
                    alignItems: 'center',
                    gap: config.theme.spacing.sm
                }}
            >
                Scan Media
            </Button>

            <Tooltip title="AWS Metrics Dashboard" arrow>
                <Button
                    component={Link}
                    to="/metrics"
                    variant={isMetricsPage ? "contained" : "outlined"}
                    startIcon={<FaChartLine />}
                    size="small"
                    sx={{
                        borderRadius: 1,
                        textTransform: 'none',
                        fontSize: '0.8rem'
                    }}
                >
                    Metrics
                </Button>
            </Tooltip>
        </Box>
    );
};

export default Header; 