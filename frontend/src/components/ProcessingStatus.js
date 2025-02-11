/**
 * ProcessingStatus.js - Real-time processing status display
 * Shows current AI processing state and progress
 * Author: Senior Dev - 2024
 */

import React, { useState, useEffect } from 'react';
import { Paper, Typography, Box, LinearProgress, Alert } from '@mui/material';
import { useWebSocketService } from '../hooks/useWebSocketService.js';
import logger from '../services/logger';

const ProcessingStatus = () => {
    const [processingStatus, setProcessingStatus] = useState(null);
    const [error, setError] = useState(null);
    
    const { isConnected, retryCount } = useWebSocketService({
        onMessage: (data) => {
            try {
                if (data.type === 'processing_update') {
                    setProcessingStatus(data);
                    setError(null); // Clear any previous errors
                }
            } catch (err) {
                logger.error('Error processing WebSocket message:', err);
                setError('Failed to process status update');
            }
        },
        onError: (err) => {
            logger.error('WebSocket error in ProcessingStatus:', err);
            setError('Connection error: ' + err.message);
        },
        onConnectionChange: (connected) => {
            if (!connected) {
                setProcessingStatus(null);
            }
        }
    });

    // Clear status when disconnected
    useEffect(() => {
        if (!isConnected) {
            setProcessingStatus(null);
        }
    }, [isConnected]);

    // Don't render anything if there's no active processing
    if (!isConnected && !error) return null;
    if (!processingStatus && !error) return null;

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
            {error ? (
                <Alert severity="error" sx={{ mb: error ? 1 : 0 }}>
                    {error}
                </Alert>
            ) : null}
            
            {!isConnected && retryCount > 0 ? (
                <Alert severity="warning" sx={{ mb: 1 }}>
                    Reconnecting... (Attempt {retryCount})
                </Alert>
            ) : null}

            {processingStatus && (
                <>
                    <Typography variant="subtitle2">
                        Processing: {processingStatus.asset_name}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                        <LinearProgress 
                            variant="determinate" 
                            value={processingStatus.progress || 0} 
                        />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                        {processingStatus.stage || 'Initializing...'}
                    </Typography>
                </>
            )}
        </Paper>
    );
};

export default ProcessingStatus; 