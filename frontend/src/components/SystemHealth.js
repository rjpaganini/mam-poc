import React, { useState, useEffect } from 'react';
import { Box, Tooltip, useTheme } from '@mui/material';
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa';
import config from '../config';

/**
 * SystemHealth Component
 * Displays system health status with detailed hover information
 * Shows database and websocket connection status
 */
const SystemHealth = ({ wsConnected }) => {
    const [dbStatus, setDbStatus] = useState('checking');
    const theme = useTheme(); // Get MUI theme

    // Status colors with fallbacks
    const statusColors = {
        success: theme.palette.success.main || '#00FF00',
        warning: theme.palette.warning.main || '#FFC107',
        error: theme.palette.error.main || '#FF0000'
    };
    
    // Check database health
    useEffect(() => {
        const checkDatabase = async () => {
            try {
                const response = await fetch(`${config.api.baseURL}/api/v1/health/status`);
                if (!response.ok) throw new Error('Database health check failed');
                const data = await response.json();
                setDbStatus(data.status === 'healthy' ? 'healthy' : 'error');
            } catch (error) {
                console.error('Database health check failed:', error);
                setDbStatus('error');
            }
        };

        // Check immediately and then every 30 seconds
        checkDatabase();
        const interval = setInterval(checkDatabase, 30000);
        return () => clearInterval(interval);
    }, []);

    // Get system health details
    const getHealthDetails = () => {
        return [
            {
                name: 'Database',
                status: dbStatus,
                message: dbStatus === 'healthy' ? 'Connected' : 'Disconnected',
                details: dbStatus === 'error' ? 'Database connection failed' : null
            },
            {
                name: 'WebSocket',
                status: wsConnected ? 'healthy' : 'error',
                message: wsConnected ? 'Connected' : 'Disconnected',
                details: wsConnected ? null : 'Real-time updates unavailable'
            }
        ];
    };

    // Get overall status based on both connections
    const getOverallStatus = (details) => {
        const statuses = details.map(d => d.status);
        if (statuses.every(s => s === 'healthy')) return 'healthy';
        if (statuses.every(s => s === 'error')) return 'error';
        return 'warning';
    };

    const healthDetails = getHealthDetails();
    const overallStatus = getOverallStatus(healthDetails);

    // Render appropriate icon based on status
    const getStatusIcon = () => {
        switch (overallStatus) {
            case 'healthy':
                return <FaCheckCircle size={16} color={statusColors.success} />;
            case 'warning':
                return <FaExclamationTriangle size={16} color={statusColors.warning} />;
            case 'error':
                return <FaTimesCircle size={16} color={statusColors.error} />;
            default:
                return null;
        }
    };

    // Generate detailed tooltip content
    const getTooltipContent = () => (
        <Box sx={{ 
            p: 1,
            minWidth: '200px',
            bgcolor: 'background.paper',
            borderRadius: 1
        }}>
            <Box sx={{ 
                fontWeight: 'bold',
                mb: 1,
                pb: 0.5,
                borderBottom: '1px solid',
                borderColor: 'divider'
            }}>
                System Health Status
            </Box>
            {healthDetails.map((detail, index) => (
                <Box key={index} sx={{ 
                    mt: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                }}>
                    {detail.status === 'healthy' ? (
                        <FaCheckCircle size={12} color={statusColors.success} />
                    ) : detail.status === 'warning' ? (
                        <FaExclamationTriangle size={12} color={statusColors.warning} />
                    ) : (
                        <FaTimesCircle size={12} color={statusColors.error} />
                    )}
                    <Box sx={{ 
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <Box sx={{ 
                            fontSize: 'caption.fontSize',
                            color: 'text.primary'
                        }}>
                            {detail.name}: {detail.message}
                        </Box>
                        {detail.details && (
                            <Box sx={{ 
                                fontSize: 'caption.fontSize',
                                color: 'text.secondary',
                                mt: 0.5
                            }}>
                                {detail.details}
                            </Box>
                        )}
                    </Box>
                </Box>
            ))}
        </Box>
    );

    return (
        <Tooltip title={getTooltipContent()} arrow placement="bottom-end">
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                p: 0.5,
                borderRadius: 1,
                '&:hover': {
                    bgcolor: 'action.hover'
                }
            }}>
                {getStatusIcon()}
            </Box>
        </Tooltip>
    );
};

export default SystemHealth; 