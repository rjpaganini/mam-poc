/**
 * ProcessingStatus.js - Simple real-time processing status display
 */
import React, { useState, useEffect } from 'react';
import { Paper, Typography, Box, LinearProgress, Alert } from '@mui/material';
import socketService from '../../services/socket';
import logger from '../../services/logger';

const ProcessingStatus = () => {
    const [status, setStatus] = useState(null);
    const [error, setError] = useState(null);
    
    useEffect(() => {
        // Handle status updates
        const handleStatus = (data) => {
            logger.debug('Processing status update:', data);
            setStatus(data);
            setError(null);
        };
        
        // Handle errors
        const handleError = (data) => {
            logger.error('Processing status error:', data);
            setError(data.message);
        };
        
        // Add listeners
        socketService.addListener('status', handleStatus);
        socketService.addListener('error', handleError);
        
        // Cleanup
        return () => {
            socketService.removeListener('status', handleStatus);
            socketService.removeListener('error', handleError);
        };
    }, []);
    
    // Don't render if no status or error
    if (!status && !error) return null;
    
    return (
        <Paper 
            sx={{ 
                position: 'fixed',
                bottom: 16,
                right: 16,
                p: 2,
                width: 300,
                zIndex: 1000
            }}
            elevation={3}
        >
            {error && (
                <Alert 
                    severity="error" 
                    sx={{ mb: 1 }}
                    onClose={() => setError(null)}
                >
                    {error}
                </Alert>
            )}
            
            {status && (
                <>
                    <Typography variant="subtitle2">
                        Processing: {status.asset_name}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                        <LinearProgress 
                            variant="determinate" 
                            value={status.progress || 0}
                        />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                        {status.stage || 'Initializing...'}
                    </Typography>
                </>
            )}
        </Paper>
    );
};

export default ProcessingStatus; 