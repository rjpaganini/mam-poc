/**
 * frontend/src/components/ProcessingVisualizer.js
 * ==========================================
 * Real-time Processing Visualization Component
 * 
 * Provides a dynamic visualization of video processing:
 * - Scene timeline with detected keyframes
 * - Real-time processing metrics
 * - Activity monitor for CPU/Memory usage
 * - Detection heatmap
 * 
 * Layout:
 * +----------------------------------+
 * |          Scene Timeline          |
 * |  [▫️▫️🔴▫️▫️🔴▫️▫️▫️🔴▫️]  |
 * +----------------------------------+
 * |     Processing Activity Grid     |
 * | CPU [||||||||  ] MEM [||||||||| ]|
 * +----------------------------------+
 * |         Detection Stats          |
 * |   Faces: 12   Objects: 45  ...  |
 * +----------------------------------+
 * 
 * Author: Senior Developer
 * Date: 2024
 */

import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

// Styled components
const Bar = styled(Box)({ 
    height: 40, 
    bgcolor: 'background.paper', 
    borderRadius: 1, 
    position: 'relative', 
    overflow: 'hidden', 
    mb: 2 
});

const Stat = styled(Box)({ 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center' 
});

const ProcessingVisualizer = ({ websocket, asset }) => {
    // Minimal state
    const [metrics, setMetrics] = useState({
        scenes: [],
        cpu: 0,
        mem: 0,
        workers: 0,
        speed: 0
    });

    // WebSocket handler
    useEffect(() => {
        if (!websocket) return;
        
        const handleMessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.type === 'processing_metrics') {
                setMetrics(m => ({
                    ...m,
                    cpu: data.cpu_usage,
                    mem: data.memory_usage,
                    workers: data.active_workers,
                    speed: data.processing_speed,
                    scenes: [...m.scenes, ...(data.new_scenes || [])]
                }));
            }
        };
        
        websocket.addEventListener('message', handleMessage);
        return () => websocket.removeEventListener('message', handleMessage);
    }, [websocket]);

    return (
        <Box sx={{ p: 2, mb: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            <Bar>
                <canvas width={800} height={40} style={{ width: '100%', height: '100%' }} />
            </Bar>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 2 }}>
                {[
                    ['Workers', metrics.workers],
                    ['Speed', `${metrics.speed.toFixed(1)} fps`],
                    ['Scenes', metrics.scenes.length],
                    ['Memory', `${metrics.mem}%`]
                ].map(([label, value]) => (
                    <Stat key={label}>
                        <Typography variant="caption">{label}</Typography>
                        <Typography variant="h6">{value}</Typography>
                    </Stat>
                ))}
            </Box>
        </Box>
    );
};

export default ProcessingVisualizer; 