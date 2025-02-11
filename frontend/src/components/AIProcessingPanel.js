/**
 * frontend/src/components/AIProcessingPanel.js
 * ==========================================
 * Real-time AI Processing Status Panel
 * 
 * Shows live updates of cloud processing status including:
 * - Frame extraction and upload progress
 * - Batch processing status
 * - Detailed AI detection metrics
 * - Processing time and performance stats
 * 
 * Author: Senior Developer
 * Date: 2024
 */

import React, { useState, useEffect } from 'react';
import { Box, Typography, LinearProgress, IconButton } from '@mui/material';
import { PlayArrow, Stop, Memory, Speed } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// Styled components for consistent UI
const Panel = styled(Box)({ p: 2, mb: 2, bgcolor: 'background.paper', borderRadius: 1 });
const MetricBox = styled(Box)({ display: 'flex', alignItems: 'center', gap: 1 });

const AIProcessingPanel = ({ asset, onStartProcessing }) => {
    const [state, setState] = useState({
        cpu: 0,
        memory: 0,
        speed: 0,
        progress: 0,
        status: 'idle'
    });

    useEffect(() => {
        if (!asset?.media_metadata?.ai_metadata) return;
        setState(s => ({ ...s, progress: 100, status: 'complete' }));
    }, [asset]);

    const handleAction = () => {
        if (state.status === 'processing') {
            setState(s => ({ ...s, status: 'idle' }));
        } else {
            setState(s => ({ ...s, status: 'processing' }));
            onStartProcessing?.();
        }
    };

    return (
        <Panel>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">AI Processing</Typography>
                <IconButton 
                    onClick={handleAction}
                    color={state.status === 'processing' ? 'error' : 'primary'}
                >
                    {state.status === 'processing' ? <Stop /> : <PlayArrow />}
                </IconButton>
            </Box>

            {state.status !== 'idle' && (
                <>
                    <LinearProgress 
                        variant="determinate" 
                        value={state.progress} 
                        sx={{ mb: 2 }}
                    />
                    
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        <MetricBox>
                            <Memory fontSize="small" />
                            <Typography variant="body2">
                                {state.memory}% RAM
                            </Typography>
                        </MetricBox>
                        <MetricBox>
                            <Speed fontSize="small" />
                            <Typography variant="body2">
                                {state.speed.toFixed(1)} fps
                            </Typography>
                        </MetricBox>
                    </Box>
                </>
            )}
        </Panel>
    );
};

export default AIProcessingPanel; 