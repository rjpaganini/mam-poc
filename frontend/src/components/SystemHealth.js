import React, { useState, useEffect, useCallback } from 'react';
import { Box, CircularProgress, Paper, Tooltip } from '@mui/material';
import config from '../config';

/**
 * SystemHealth component displays real-time system metrics
 * Positioned at bottom left, frozen on scroll
 * Handles undefined values safely with fallbacks
 */
const SystemHealth = () => {
    const [health, setHealth] = useState(null);
    const [error, setError] = useState(null);

    // Helper function to get the active port
    const getActivePort = async () => {
        try {
            // Try ports 5001 and 5002
            for (const port of [5001, 5002]) {
                try {
                    const response = await fetch(`http://localhost:${port}/api/v1/health`);
                    if (response.ok) {
                        return port;
                    }
                } catch (error) {
                    console.warn(`Port ${port} not available:`, error);
                }
            }
            throw new Error('No available ports found');
        } catch (error) {
            console.error('Failed to get active port:', error);
            return 5001; // Default fallback
        }
    };

    // Fetch health data with retry logic
    const fetchHealthWithRetry = useCallback(async (attempt = 0) => {
        try {
            const port = await getActivePort();
            const response = await fetch(`http://localhost:${port}/api/v1/health`);
            if (!response.ok) {
                throw new Error(`Health check failed with status: ${response.status}`);
            }
            const data = await response.json();
            
            // Ensure memory data is properly formatted
            if (data.memory) {
                data.memory = {
                    percent: typeof data.memory.percent === 'number' ? data.memory.percent : 0,
                    rss: typeof data.memory.rss === 'number' ? data.memory.rss : 0
                };
            }
            
            setHealth(data);
            setError(null);
        } catch (err) {
            console.error('Health check failed:', err);
            setError(err.message);
            
            if (attempt < 3) {
                setTimeout(() => fetchHealthWithRetry(attempt + 1), 
                    Math.min(1000 * Math.pow(2, attempt), 10000));
            }
        }
    }, []);

    useEffect(() => {
        fetchHealthWithRetry();
        const interval = setInterval(fetchHealthWithRetry, 30000);
        return () => clearInterval(interval);
    }, [fetchHealthWithRetry]);

    // Safe number formatting with fallback
    const formatNumber = (value, decimals = 1) => {
        return typeof value === 'number' ? value.toFixed(decimals) : '0';
    };

    // Status indicator with tooltip
    const StatusIndicator = ({ value, color, tooltip }) => (
        <Tooltip title={tooltip} arrow placement="top">
            <Box sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: color,
                boxShadow: `0 0 10px ${color}40`,
                transition: 'all 0.3s'
            }} />
        </Tooltip>
    );

    return (
        <Paper sx={{
            position: 'fixed',
            left: 20,
            bottom: 20,
            width: 220,
            p: 2,
            backgroundColor: config.theme.colors.surface,
            color: config.theme.colors.text.primary,
            borderRadius: config.theme.radius.md,
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
            <Box sx={{ fontSize: '0.875rem', mb: 1, fontWeight: 500 }}>
                System Health Monitor
            </Box>
            
            {error ? (
                <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    gap: 1,
                    color: config.theme.colors.error 
                }}>
                    <StatusIndicator 
                        color={config.theme.colors.error}
                        tooltip="System health check failed" 
                    />
                    Error: {error}
                </Box>
            ) : !health ? (
                <CircularProgress size={20} />
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Memory Usage */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <StatusIndicator 
                            color={(health.memory?.system_percent || 0) > 90 
                                ? config.theme.colors.error 
                                : config.theme.colors.success}
                            tooltip={`System Memory: ${formatNumber(health.memory?.system_percent)}% used`}
                        />
                        <Box>
                            Memory Usage
                            <Box sx={{ fontSize: '0.75rem', color: config.theme.colors.text.secondary }}>
                                App: {formatNumber(health.memory?.percent)}% ({formatNumber((health.memory?.rss || 0) / (1024 * 1024))} MB)
                                <br/>
                                System: {formatNumber(health.memory?.system_percent)}%
                            </Box>
                        </Box>
                    </Box>

                    {/* Database Status */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <StatusIndicator 
                            color={health.database?.connected 
                                ? config.theme.colors.success 
                                : config.theme.colors.error}
                            tooltip={`Database: ${health.database?.connected ? 'Connected' : 'Disconnected'}`}
                        />
                        <Box>
                            Database
                            <Box sx={{ fontSize: '0.75rem', color: config.theme.colors.text.secondary }}>
                                {health.database?.active_sessions || 0} active sessions
                            </Box>
                        </Box>
                    </Box>

                    {/* WebSocket Status */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <StatusIndicator 
                            color={(health.websocket?.active_connections || 0) > 0 
                                ? config.theme.colors.success 
                                : config.theme.colors.error}
                            tooltip={`WebSocket: ${health.websocket?.active_connections || 0} active connections`}
                        />
                        <Box>
                            Real-time Updates
                            <Box sx={{ fontSize: '0.75rem', color: config.theme.colors.text.secondary }}>
                                {health.websocket?.active_connections || 0} connected clients
                            </Box>
                        </Box>
                    </Box>
                </Box>
            )}
        </Paper>
    );
};

export default SystemHealth; 