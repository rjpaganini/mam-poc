import React, { useState, useEffect } from 'react';
import { Box, Popover } from '@mui/material';
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa';
import config from '../config';

/**
 * SystemHealth Component
 * Displays system health status with click-to-view details
 */
const SystemHealth = ({ wsConnected }) => {
    const [healthData, setHealthData] = useState({
        status: 'checking',
        database: {
            status: 'checking',
            message: 'Checking database connection...'
        }
    });
    
    // State for dialog visibility
    const [isOpen, setIsOpen] = useState(false);
    
    // Check health status
    useEffect(() => {
        const checkHealth = async () => {
            try {
                const response = await fetch(`${config.api.baseURL}${config.api.endpoints.health}`);
                if (!response.ok) throw new Error('Health check failed');
                const data = await response.json();
                setHealthData(data);
            } catch (error) {
                setHealthData(prev => ({
                    ...prev,
                    status: 'error',
                    database: {
                        ...prev.database,
                        status: 'error',
                        message: error.message
                    }
                }));
            }
        };

        checkHealth();
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    // Get overall status
    const getStatus = () => {
        if (healthData.status === 'healthy' && wsConnected) return 'healthy';
        if (healthData.status === 'error' || !wsConnected) return 'error';
        return 'warning';
    };

    // Get status icon
    const getIcon = () => {
        const status = getStatus();
        switch (status) {
            case 'healthy':
                return <FaCheckCircle size={16} style={{ pointerEvents: 'none' }} color="#4caf50" />;
            case 'warning':
                return <FaExclamationTriangle size={16} style={{ pointerEvents: 'none' }} color="#ff9800" />;
            case 'error':
                return <FaTimesCircle size={16} style={{ pointerEvents: 'none' }} color="#f44336" />;
            default:
                return null;
        }
    };

    // Handle click outside
    const handleClickOutside = (event) => {
        if (event.target.getAttribute('data-overlay') === 'true') {
            setIsOpen(false);
        }
    };

    // Handle close button click
    const handleClose = (event) => {
        event.stopPropagation();
        setIsOpen(false);
    };

    return (
        <>
            <Box 
                role="button"
                aria-label="System Health Status"
                onClick={() => setIsOpen(true)}
                sx={{ 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: getStatus() === 'error' ? 'error.main' : 'divider',
                    backgroundColor: 'background.paper',
                    WebkitAppRegion: 'no-drag',
                    position: 'relative',
                    zIndex: 3,
                    '& svg': {
                        display: 'block',
                        margin: 'auto',
                        pointerEvents: 'none'
                    },
                    '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)'
                    },
                    '&:active': {
                        backgroundColor: 'rgba(255, 255, 255, 0.1)'
                    }
                }}
            >
                {getIcon()}
            </Box>

            {isOpen && (
                <Box
                    onClick={handleClickOutside}
                    data-overlay="true"
                    sx={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'transparent',
                        zIndex: 9998
                    }}
                >
                    <Box
                        onClick={(e) => e.stopPropagation()}
                        sx={{
                            position: 'fixed',
                            top: '16px',
                            right: '16px',
                            maxWidth: '300px',
                            zIndex: 9999,
                            p: 2,
                            borderRadius: 1,
                            backgroundColor: 'background.paper',
                            border: '1px solid',
                            borderColor: 'divider',
                            boxShadow: 3
                        }}
                    >
                        {/* Header */}
                        <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 1,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            pb: 1,
                            mb: 1
                        }}>
                            {getIcon()}
                            <Box sx={{ 
                                fontWeight: 'medium',
                                fontSize: '0.7rem'
                            }}>
                                System Health Status
                            </Box>
                            {/* Close button */}
                            <Box
                                onClick={handleClose}
                                sx={{
                                    ml: 'auto',
                                    cursor: 'pointer',
                                    color: 'text.secondary',
                                    fontSize: '1rem',
                                    lineHeight: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '4px',
                                    borderRadius: '4px',
                                    '&:hover': {
                                        color: 'error.main',
                                        backgroundColor: 'action.hover'
                                    }
                                }}
                            >
                                ×
                            </Box>
                        </Box>

                        {/* Status display */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box component="span" sx={{ 
                                    color: healthData.database.status === 'healthy' ? '#4caf50' : '#f44336',
                                    fontSize: '0.7rem'
                                }}>●</Box>
                                <Box sx={{ fontSize: '0.7rem' }}>
                                    Database {healthData.database.status === 'healthy' ? 'Connected' : 'Disconnected'}
                                </Box>
                            </Box>
                            
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box component="span" sx={{ 
                                    color: wsConnected ? '#4caf50' : '#f44336',
                                    fontSize: '0.7rem'
                                }}>●</Box>
                                <Box sx={{ fontSize: '0.7rem' }}>
                                    WebSocket {wsConnected ? 'Connected' : 'Disconnected'}
                                </Box>
                            </Box>
                        </Box>

                        {/* Error details if any */}
                        {getStatus() === 'error' && healthData.database.message && (
                            <Box sx={{ 
                                mt: 2,
                                pt: 2,
                                borderTop: '1px solid',
                                borderColor: 'divider',
                                color: 'error.main',
                                fontSize: '0.7rem'
                            }}>
                                Error Details: {healthData.database.message}
                            </Box>
                        )}
                    </Box>
                </Box>
            )}
        </>
    );
};

export default SystemHealth; 