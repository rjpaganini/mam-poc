/**
 * @file: AssetDetails.js
 * @type: Component (Route-Level)
 * @description: Detailed view component for individual media assets.
 * 
 * This component provides a comprehensive view of a single media asset, including:
 * - Video playback with controls
 * - Technical metadata display (resolution, codec, bitrate, etc.)
 * - File information and location
 * - Navigation controls
 * 
 * Layout Structure:
 * ┌─────────────────────────────────────────────────┐
 * │ Back Button         Asset Title                 │
 * ├───────────────────────┬─────────────────────────┤
 * │                       │                         │
 * │                       │     Metadata Panel      │
 * │    Video Panel       │     - File Size         │
 * │                       │     - Resolution        │
 * │                       │     - Duration          │
 * │                       │     - Frame Rate        │
 * │                       │     - Codec            │
 * │                       │     - Format           │
 * │                       │                         │
 * │                       │     [File Path]         │
 * └───────────────────────┴─────────────────────────┘
 * 
 * @hierarchy
 * App
 * └─ AssetDetails (this file)
 *    ├─ Video Player
 *    └─ Metadata Panel
 * 
 * @dependencies
 * - @mui/material: UI components and styling
 * - react-router-dom: Navigation and routing
 * - fileUtils: File system operations
 * - formatters: Data formatting utilities
 * 
 * @features
 * - Responsive video playback
 * - Real-time metadata display
 * - File system integration
 * - Error boundary protection
 * - Keyboard navigation support
 */

import React, { useState, useEffect } from 'react';
import { Box, Paper, CircularProgress, Typography, LinearProgress, Tooltip, Grid, Button } from '@mui/material';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import config from '../config';
import { openFolder } from '../utils/fileUtils';
import logger from '../services/logger';
import { assetsApi } from '../services/api';
import { formatFileSize } from '../utils/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { PlayArrow } from '@mui/icons-material';

// Error boundary for asset details
class AssetDetailsErrorBoundary extends React.Component {
    state = { hasError: false, error: null };

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        logger.error('AssetDetails render failed', error, {
            component: 'AssetDetails',
            errorInfo,
            path: window.location.pathname
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <Box sx={{
                    p: 3,
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    color: 'error.main'
                }}>
                    <h2>Something went wrong</h2>
                    <p>Failed to display asset details. Please try refreshing the page.</p>
                </Box>
            );
        }
        return this.props.children;
    }
}

/**
 * AssetDetails component for displaying detailed media information
 * Ensures consistent dark theme throughout with proper background coverage
 */
const AssetDetails = () => {
    const { id } = useParams();
    const { state } = useLocation();
    const navigate = useNavigate();
    const [asset, setAsset] = useState(state?.asset);
    const [videoError, setVideoError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showPath, setShowPath] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [videoUrl, setVideoUrl] = useState('');
    const [isVideoLoading, setIsVideoLoading] = useState(true);

    // Define fetchAsset function at component level
    const fetchAsset = async () => {
        try {
            const response = await fetch(`${config.api.baseURL}/assets/${id}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setAsset(data);
            setIsLoading(false);
        } catch (error) {
            console.error('Error fetching asset:', error);
            setError(error.message);
            setIsLoading(false);
        }
    };

    // Add keyboard shortcut for navigation
    useEffect(() => {
        const handleKeyPress = (e) => {
            // Navigate back on Esc or Cmd/Ctrl + Left Arrow
            if (e.key === 'Escape' || (e.key === 'ArrowLeft' && (e.metaKey || e.ctrlKey))) {
                navigate('/');
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [navigate]);

    // Fetch asset data on component mount
    useEffect(() => {
        fetchAsset();
    }, [id, state?.asset]);

    useEffect(() => {
        if (!asset) {
            // Only log warning if data isn't available after 2 seconds
            const warningTimeout = setTimeout(() => {
                logger.warn('Asset details still not available after timeout', {
                    path: window.location.pathname,
                    state,
                    timestamp: new Date().toISOString()
                });
            }, 2000);
            
            return () => clearTimeout(warningTimeout);
        } else {
            logger.info('Asset details viewed', {
                assetId: asset.id,
                title: asset.title,
                state
            });
        }
    }, [asset, state]);

    // Get video URL through the media:// protocol
    const getVideoPath = (asset) => {
        if (!asset?.file_path) return '';
        // Use the media:// protocol to stream directly through Electron
        return `media://${encodeURIComponent(asset.file_path)}`;
    };

    // Handle opening folder in Finder
    const handleOpenFolder = () => {
        if (!asset?.file_path) {
            logger.warn('Cannot open folder: No file path available', {
                assetId: asset?.id,
                title: asset?.title
            });
            return;
        }
        
        try {
            openFolder(asset.file_path);
            logger.info('Opening folder for asset', {
                assetId: asset.id,
                path: asset.file_path
            });
        } catch (error) {
            logger.error('Failed to open folder:', error, {
                assetId: asset.id,
                path: asset.file_path
            });
        }
    };

    // Enhanced error handling with retry logic
    const handleVideoError = (event) => {
        const error = event.target.error;
        const videoElement = event.target;
        
        setVideoError(error);
        setIsVideoLoading(false);

        // Enhanced error logging
        console.error('Video playback error:', {
            code: error?.code,
            message: error?.message,
            src: videoElement?.src,
            readyState: videoElement?.readyState,
            networkState: videoElement?.networkState,
            error: videoElement?.error
        });
    };

    // Handle video loaded metadata
    const handleVideoLoaded = () => {
        setIsVideoLoading(false);
        setVideoError(null);
    };

    // Handle copy to clipboard with visual feedback
    const handleCopy = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            // Reset copy feedback after 2 seconds
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            logger.error('Failed to copy to clipboard:', err);
        }
    };

    // Format metadata values for display with error handling
    const formatMetadataValue = (key, value) => {
        try {
            // Handle file size (stored in bytes at root level)
            if (key === 'file_size') {
                return formatFileSize(value);
            }

            // Handle objects (like audio info)
            if (typeof value === 'object' && value !== null) {
                if ('channels' in value && 'codec' in value) {
                    // Format audio info
                    return `${value.codec} (${value.channels}ch, ${value.sample_rate}Hz)`;
                }
                return '-';
            }

            // Handle specific metadata types
            switch (key) {
                case 'duration':
                    // Format as timecode (00:00:00)
                    const totalSeconds = Math.round(value);
                    const hours = Math.floor(totalSeconds / 3600);
                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                    const seconds = totalSeconds % 60;
                    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                case 'fps':
                    return `${Number(value).toFixed(2)}`;
                case 'bitrate':
                    // Convert to Mbps with proper formatting
                    const mbps = value / 1000000; // Convert to Mbps
                    if (mbps >= 1) {
                        return `${mbps.toFixed(1)} Mbps`;
                    } else {
                        // For bitrates less than 1 Mbps, show in Kbps
                        const kbps = value / 1000;
                        return `${kbps.toFixed(0)} Kbps`;
                    }
                case 'width':
                case 'height':
                    // These will be combined into resolution
                    return value.toString();
                default:
                    return value?.toString() || '-';
            }
        } catch (error) {
            logger.error('Metadata formatting error', error, {
                key,
                value,
                assetId: asset?.id
            });
            return '-';
        }
    };

    // Filter and transform metadata for display
    const getDisplayMetadata = (asset) => {
        if (!asset) return [];
        
        const displayItems = [];
        
        // 1. File Size
        if (asset.file_size) {
            displayItems.push({
                label: 'File Size',
                value: formatMetadataValue('file_size', asset.file_size)
            });
        }
        
        // 2. Resolution
        if (asset.width && asset.height) {
            displayItems.push({
                label: 'Resolution',
                value: `${asset.width}×${asset.height}`
            });
        }
        
        // 3. Duration
        if (asset.duration) {
            displayItems.push({
                label: 'Duration',
                value: formatMetadataValue('duration', asset.duration)
            });
        }
        
        // 4. Frame Rate
        if (asset.fps) {
            displayItems.push({
                label: 'Frame Rate',
                value: formatMetadataValue('fps', asset.fps)
            });
        }
        
        // 5. File Format
        const fileExt = asset.file_path?.split('.').pop()?.toUpperCase();
        if (fileExt) {
            displayItems.push({
                label: 'File Format',
                value: fileExt
            });
        }
        
        // 6. Video Codec
        if (asset.codec) {
            displayItems.push({
                label: 'Video Codec',
                value: asset.codec.toUpperCase()
            });
        }
        
        // 7. Video Bitrate
        if (asset.bit_rate) {
            displayItems.push({
                label: 'Bitrate',
                value: formatMetadataValue('bitrate', asset.bit_rate)
            });
        }
        
        // 8. Audio Information
        if (asset.audio_codec) {
            displayItems.push({
                label: 'Audio',
                value: `${asset.audio_codec.toUpperCase()} (${asset.audio_channels}ch, ${asset.audio_sample_rate}Hz)`
            });
        }
        
        return displayItems;
    };

    // Update file path formatting to show only the relevant part of the path
    const formatFilePath = (path) => {
        if (!path) return '';
        // Show only the path from 'My Drive' onwards
        return `My Drive/Business/Valen Media/valn.io/exploration/valn.io/Data/Raw_Videos/${path}`;
    };

    // Base container style to ensure dark theme coverage and proper spacing
    const containerStyle = {
        position: 'fixed',
        top: '64px', // Increased from 48px for more breathing room
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: 'background.default',
        overflow: 'auto',
        p: 3 // Using MUI's spacing units
    };

    // Helper functions for AI processing metadata
    const getProcessingStatus = (asset) => {
        const aiMetadata = asset?.media_metadata?.ai_metadata;
        if (!aiMetadata) return 'Not Started';
        if (aiMetadata.error) return 'Failed';
        if (aiMetadata.processed_at) return 'Completed';
        return 'Processing';
    };

    const getProcessingProgress = (asset) => {
        const aiMetadata = asset?.media_metadata?.ai_metadata;
        if (!aiMetadata) return 0;
        if (aiMetadata.processed_at) return 100;
        
        // Calculate progress based on completed tasks
        const tasks = ['scene_detection', 'logo_detection', 'object_detection', 'face_detection'];
        const completedTasks = tasks.filter(task => aiMetadata[task]?.completed).length;
        return (completedTasks / tasks.length) * 100;
    };

    // AIProcessingPanel: Displays AI processing status and controls
    // Layout structure:
    // ┌─────────────────────────────────┐
    // │     AI Video Processing         │
    // │     [Process Button]            │
    // │     Status: Not Started (0%)    │
    // │     [Progress Bar]              │
    // │  ┌─────────────┐ ┌────────────┐ │
    // │  │ Scenes: 0   │ │ Logo: 0%   │ │
    // │  └─────────────┘ └────────────┘ │
    // │  ┌─────────────┐ ┌────────────┐ │
    // │  │ Objects: 0  │ │ Faces: 0   │ │
    // │  └─────────────┘ └────────────┘ │
    // └─────────────────────────────────┘
    const AIProcessingPanel = ({ asset, onStartProcessing }) => {
        const status = getProcessingStatus(asset);
        const progress = getProcessingProgress(asset);
        const aiMetadata = asset?.media_metadata?.ai_metadata || {};

        return (
            <Box sx={{ 
                p: 2, 
                bgcolor: 'background.paper',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                mb: 2,
                overflow: 'hidden'
            }}>
                {/* Title Section */}
                <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: 1,
                    mb: 2
                }}>
                    <Typography 
                        variant="subtitle2" 
                        sx={{ 
                            fontSize: '0.7rem',
                            fontWeight: 500,
                            color: 'text.primary'
                        }}
                    >
                        AI Video Processing
                    </Typography>

                    {/* Process Button - Only show if not started or if there was an error */}
                    {(status === 'Not Started' || status === 'Failed') && (
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<PlayArrow sx={{ fontSize: '0.8rem' }} />}
                            onClick={onStartProcessing}
                            disabled={isProcessing}
                            sx={{ 
                                alignSelf: 'flex-start',
                                minWidth: 'auto',
                                height: '22px',
                                fontSize: '0.6rem',
                                padding: '2px 8px',
                                borderColor: 'divider',
                                color: 'text.primary',
                                textTransform: 'none',
                                '&:hover': {
                                    borderColor: 'primary.main',
                                    bgcolor: 'transparent'
                                }
                            }}
                        >
                            {isProcessing ? 'Starting...' : 'Process'}
                        </Button>
                    )}

                    {/* Error Display */}
                    {error && (
                        <Typography 
                            variant="caption" 
                            color="error"
                            sx={{ fontSize: '0.6rem' }}
                        >
                            {error}
                        </Typography>
                    )}
                </Box>
                
                {/* Progress Section */}
                <Box sx={{ mb: 2 }}>
                    {/* Status and Percentage */}
                    <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        mb: 0.5 
                    }}>
                        <Typography 
                            variant="caption" 
                            sx={{ 
                                fontSize: '0.6rem',
                                color: 'text.secondary'
                            }}
                        >
                            Status: {status}
                        </Typography>
                        <Typography 
                            variant="caption" 
                            sx={{ 
                                fontSize: '0.6rem',
                                color: 'text.secondary'
                            }}
                        >
                            {Math.round(progress)}%
                        </Typography>
                    </Box>

                    {/* Progress Bar */}
                    <LinearProgress 
                        variant="determinate" 
                        value={progress}
                        sx={{ 
                            height: 4, 
                            borderRadius: 2,
                            bgcolor: 'background.default',
                            '& .MuiLinearProgress-bar': {
                                bgcolor: status === 'Completed' ? 'success.main' : 'primary.main'
                            }
                        }}
                    />
                </Box>

                {/* Processing Results Grid */}
                <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: 1.5,
                    '& .MuiTypography-root': {  // Common typography styles
                        fontSize: '0.6rem'
                    }
                }}>
                    {/* Scene Detection Stats */}
                    <Tooltip title="Number of distinct scenes detected in the video">
                        <Box>
                            <Typography 
                                variant="caption" 
                                color="text.secondary"
                                sx={{ display: 'block', mb: 0.5 }}
                            >
                                Scenes Detected
                            </Typography>
                            <Typography sx={{ fontWeight: 500 }}>
                                {aiMetadata.scene_detection?.scenes?.length || 0}
                            </Typography>
                        </Box>
                    </Tooltip>

                    {/* Logo Detection Stats */}
                    <Tooltip title="Percentage of frames containing detected logos">
                        <Box>
                            <Typography 
                                variant="caption" 
                                color="text.secondary"
                                sx={{ display: 'block', mb: 0.5 }}
                            >
                                Logo Coverage
                            </Typography>
                            <Typography sx={{ fontWeight: 500 }}>
                                {aiMetadata.logo_detection?.coverage 
                                    ? `${(aiMetadata.logo_detection.coverage * 100).toFixed(1)}%`
                                    : '0%'
                                }
                            </Typography>
                        </Box>
                    </Tooltip>

                    {/* Object Detection Stats */}
                    <Tooltip title="Number of unique objects detected throughout the video">
                        <Box>
                            <Typography 
                                variant="caption" 
                                color="text.secondary"
                                sx={{ display: 'block', mb: 0.5 }}
                            >
                                Objects Detected
                            </Typography>
                            <Typography sx={{ fontWeight: 500 }}>
                                {aiMetadata.object_detection?.unique_objects?.length || 0}
                            </Typography>
                        </Box>
                    </Tooltip>

                    {/* Face Detection Stats */}
                    <Tooltip title="Number of unique faces detected in the video">
                        <Box>
                            <Typography 
                                variant="caption" 
                                color="text.secondary"
                                sx={{ display: 'block', mb: 0.5 }}
                            >
                                Faces Detected
                            </Typography>
                            <Typography sx={{ fontWeight: 500 }}>
                                {aiMetadata.face_detection?.unique_faces?.length || 0}
                            </Typography>
                        </Box>
                    </Tooltip>
                </Box>

                {/* Processing Timeline - Only show when processing is complete */}
                {aiMetadata.processed_at && (
                    <Box sx={{ 
                        mt: 2, 
                        pt: 2, 
                        borderTop: '1px solid', 
                        borderColor: 'divider',
                        '& .MuiTypography-root': {
                            fontSize: '0.55rem'
                        }
                    }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                            Started: {new Date(aiMetadata.started_at).toLocaleString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                            Completed: {new Date(aiMetadata.processed_at).toLocaleString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                            Duration: {((new Date(aiMetadata.processed_at) - new Date(aiMetadata.started_at)) / 1000).toFixed(1)}s
                        </Typography>
                    </Box>
                )}

                {/* Error Display */}
                {aiMetadata.error && (
                    <Box sx={{ 
                        mt: 2, 
                        p: 1, 
                        bgcolor: 'error.dark',
                        color: 'error.contrastText', 
                        borderRadius: 1,
                        fontSize: '0.6rem'
                    }}>
                        <Typography variant="caption">
                            Error: {aiMetadata.error}
                        </Typography>
                    </Box>
                )}
            </Box>
        );
    };

    // Add new visualization components
    const SceneAnalysisChart = ({ scenes }) => {
        if (!scenes?.length) return null;

        // Process scene data for visualization
        const sceneData = scenes.map((scene, index) => ({
            id: index + 1,
            duration: scene.duration,
            start: scene.start_time,
            end: scene.end_time
        }));

        return (
            <Box sx={{ height: 200, width: '100%', mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                    Scene Duration Analysis
                </Typography>
                <ResponsiveContainer>
                    <BarChart data={sceneData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="id" label={{ value: 'Scene Number', position: 'bottom' }} />
                        <YAxis label={{ value: 'Duration (s)', angle: -90, position: 'left' }} />
                        <Tooltip 
                            content={({ active, payload }) => {
                                if (active && payload?.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <Box sx={{ bgcolor: 'background.paper', p: 1, border: '1px solid', borderColor: 'divider' }}>
                                            <Typography variant="caption" display="block">
                                                Scene {data.id}
                                            </Typography>
                                            <Typography variant="caption" display="block">
                                                Duration: {data.duration.toFixed(1)}s
                                            </Typography>
                                            <Typography variant="caption" display="block">
                                                Time: {data.start.toFixed(1)}s - {data.end.toFixed(1)}s
                                            </Typography>
                                        </Box>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Bar dataKey="duration" fill="#8884d8" />
                    </BarChart>
                </ResponsiveContainer>
            </Box>
        );
    };

    const LogoDetectionTimeline = ({ logoData }) => {
        if (!logoData?.logo_appearances?.length) return null;

        // Process logo data for visualization
        const timelineData = Array.from({ length: 20 }, (_, i) => ({
            timeSegment: i * 5,
            coverage: 0
        }));

        logoData.logo_appearances.forEach(appearance => {
            const segment = Math.floor(appearance.timestamp / 5);
            if (segment < timelineData.length) {
                timelineData[segment].coverage += 1;
            }
        });

        return (
            <Box sx={{ height: 200, width: '100%', mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                    Logo Presence Timeline
                </Typography>
                <ResponsiveContainer>
                    <AreaChart data={timelineData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timeSegment" label={{ value: 'Time (s)', position: 'bottom' }} />
                        <YAxis label={{ value: 'Logo Occurrences', angle: -90, position: 'left' }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="coverage" stroke="#82ca9d" fill="#82ca9d" />
                    </AreaChart>
                </ResponsiveContainer>
            </Box>
        );
    };

    const ProcessingActivityMonitor = ({ asset }) => {
        const [activities, setActivities] = useState([]);
        const maxDataPoints = 30;

        // Simulate or fetch real processing activities
        useEffect(() => {
            if (!asset?.media_metadata?.ai_metadata?.processing_stats) return;

            const stats = asset.media_metadata.ai_metadata.processing_stats;
            const newActivities = [];

            if (stats.scene_detection) {
                newActivities.push({
                    name: 'Scene Detection',
                    cpu: stats.scene_detection.cpu_usage || 0,
                    memory: stats.scene_detection.memory_usage || 0,
                });
            }
            if (stats.logo_detection) {
                newActivities.push({
                    name: 'Logo Detection',
                    cpu: stats.logo_detection.cpu_usage || 0,
                    memory: stats.logo_detection.memory_usage || 0,
                });
            }

            setActivities(newActivities);
        }, [asset]);

        if (!activities.length) return null;

        return (
            <Box sx={{ height: 200, width: '100%', mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                    Processing Resource Usage
                </Typography>
                <ResponsiveContainer>
                    <BarChart data={activities} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} />
                        <YAxis dataKey="name" type="category" />
                        <Tooltip />
                        <Bar dataKey="cpu" name="CPU Usage %" fill="#8884d8" />
                        <Bar dataKey="memory" name="Memory Usage %" fill="#82ca9d" />
                    </BarChart>
                </ResponsiveContainer>
            </Box>
        );
    };

    // Add new AIVisualizationPanel component
    const AIVisualizationPanel = ({ asset }) => {
        const aiMetadata = asset?.media_metadata?.ai_metadata;
        
        if (!aiMetadata) {
            return (
                <Box sx={{ 
                    p: 3, 
                    textAlign: 'center',
                    color: 'text.secondary',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    mt: 3
                }}>
                    <Typography>
                        No AI processing data available
                    </Typography>
                </Box>
            );
        }

        return (
            <Box sx={{ 
                mt: 3, 
                pt: 3, 
                borderTop: '1px solid', 
                borderColor: 'divider'
            }}>
                <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                    AI Processing Analysis
                </Typography>

                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <ProcessingActivityMonitor asset={asset} />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                        <SceneAnalysisChart scenes={aiMetadata.scene_detection?.scenes} />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                        <LogoDetectionTimeline logoData={aiMetadata.logo_detection} />
                    </Grid>
                </Grid>
            </Box>
        );
    };

    // Add function to start processing
    const handleStartProcessing = async () => {
        try {
            setIsProcessing(true);
            setError(null); // Clear any previous errors
            
            // Debug logging
            console.log('Config baseURL:', config.api.baseURL);
            console.log('Config process endpoint:', config.api.endpoints.process);
            console.log('Asset ID:', asset.id);
            
            // Remove any duplicate /api/v1 from baseURL and construct URL using process endpoint
            const baseUrl = config.api.baseURL.replace(/\/+$/, '');
            const processPath = config.api.endpoints.process.replace(/^\/+/, '');
            const processUrl = `${baseUrl}/${processPath}/${asset.id}`;
            
            console.log('Final process URL:', processUrl);
            
            const response = await fetch(processUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            // Enhanced response logging
            console.log('Response status:', response.status);
            console.log('Response status text:', response.statusText);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                console.error('Error data:', errorData);
                throw new Error(`Processing failed: ${response.status} ${errorData ? JSON.stringify(errorData) : response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Processing initiated successfully:', data);
            
            // Show success message
            setError(null);
            
            // Refresh asset data after a short delay
            setTimeout(() => {
                console.log('Refreshing asset data...');
                fetchAsset();
            }, 1000);
            
        } catch (error) {
            console.error('Failed to start processing:', error);
            // Log the error properly
            logger.error('AI Processing failed:', error, {
                assetId: asset?.id,
                path: window.location.pathname,
                timestamp: new Date().toISOString()
            });
            // Show user feedback
            setError('Failed to start processing. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const ValidationPanel = ({ detections, onValidate }) => {
        return (
            <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" gutterBottom>
                    Validation Interface
                </Typography>
                
                {/* Scene Validation */}
                <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Scene Detection</Typography>
                    {detections.scenes?.map((scene, index) => (
                        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                            <Typography>
                                Scene {index + 1}: {scene.start.toFixed(2)}s - {scene.end.toFixed(2)}s
                            </Typography>
                            <Button 
                                size="small" 
                                variant="outlined" 
                                color="error"
                                onClick={() => onValidate('scene', index, false)}
                            >
                                Invalid
                            </Button>
                            <Button 
                                size="small" 
                                variant="outlined" 
                                color="success"
                                onClick={() => onValidate('scene', index, true)}
                            >
                                Valid
                            </Button>
                        </Box>
                    ))}
                </Box>
                
                {/* Logo Validation */}
                <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Logo Detection</Typography>
                    {detections.logos?.map((logo, index) => (
                        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                            <Typography>
                                Logo at {logo.timestamp.toFixed(2)}s 
                                (Confidence: {(logo.confidence * 100).toFixed(1)}%)
                            </Typography>
                            <Button 
                                size="small" 
                                variant="outlined" 
                                color="error"
                                onClick={() => onValidate('logo', index, false)}
                            >
                                Invalid
                            </Button>
                            <Button 
                                size="small" 
                                variant="outlined" 
                                color="success"
                                onClick={() => onValidate('logo', index, true)}
                            >
                                Valid
                            </Button>
                        </Box>
                    ))}
                </Box>
                
                {/* Object Detection Validation */}
                <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Object Detection</Typography>
                    {detections.objects?.map((obj, index) => (
                        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                            <Typography>
                                {obj.name} at {obj.timestamp.toFixed(2)}s 
                                (Confidence: {obj.confidence.toFixed(1)}%)
                            </Typography>
                            <Button 
                                size="small" 
                                variant="outlined" 
                                color="error"
                                onClick={() => onValidate('object', index, false)}
                            >
                                Invalid
                            </Button>
                            <Button 
                                size="small" 
                                variant="outlined" 
                                color="success"
                                onClick={() => onValidate('object', index, true)}
                            >
                                Valid
                            </Button>
                        </Box>
                    ))}
                </Box>
            </Box>
        );
    };

    // Show loading state
    if (isLoading) {
        return (
            <Box sx={containerStyle}>
                <Box sx={{ 
                    maxWidth: '1200px', 
                    margin: '0 auto',
                    padding: 2,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%'
                }}>
                    <CircularProgress />
                </Box>
            </Box>
        );
    }

    // Show error state if no asset found
    if (!asset) {
        return (
            <Box sx={containerStyle}>
                <Box sx={{ 
                    maxWidth: '1200px', 
                    margin: '0 auto',
                    p: 2
                }}>
                    <Button 
                        onClick={() => navigate('/')}
                        variant="outlined"
                        size="small"
                        sx={{ mb: 2 }}
                    >
                        ← Back to Library
                    </Button>
                    <Box sx={{ 
                        color: 'error.main',
                        textAlign: 'center',
                        mt: 4
                    }}>
                        Asset not found
                    </Box>
                </Box>
            </Box>
        );
    }

    return (
        <AssetDetailsErrorBoundary>
            <Box sx={containerStyle}>
                {/* Main container with increased max width to accommodate side-by-side layout */}
                <Box sx={{ 
                    maxWidth: '1400px', // Increased to accommodate side-by-side layout
                    margin: '0 auto',
                    padding: 2
                }}>
                    {/* Header Section */}
                    <Box sx={{ 
                        display: 'flex',
                        alignItems: 'center',
                        mb: 2,
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                        bgcolor: 'background.default'
                    }}>
                        <Button 
                            onClick={() => navigate('/')}
                            variant="outlined"
                            size="small"
                            sx={{
                                minWidth: 'auto',
                                p: '4px 8px',
                                fontSize: '0.8rem'
                            }}
                        >
                            ←
                        </Button>
                        <Typography 
                            variant="h6" 
                            sx={{ 
                                m: 0,
                                ml: 2,
                                color: 'text.primary',
                                fontSize: '1.2rem',
                                fontWeight: 500
                            }}
                        >
                            {asset.title}
                        </Typography>
                    </Box>

                    {/* Content Container - Side by Side Layout */}
                    <Box sx={{
                        display: 'flex',
                        gap: 2, // Reduced gap between panels
                        alignItems: 'stretch'
                    }}>
                        {/* Video Player Container */}
                        <Box sx={{
                            flex: '1 1 85%',
                            bgcolor: 'background.paper',
                            borderRadius: 1,
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <video
                                key={asset.id} // Force remount on asset change
                                controls
                                style={{
                                    width: '100%',
                                    height: 'auto',
                                    maxHeight: '70vh',
                                    backgroundColor: '#000',
                                    display: isVideoLoading ? 'none' : 'block'
                                }}
                                onError={handleVideoError}
                                onLoadedMetadata={handleVideoLoaded}
                                onLoadedData={handleVideoLoaded}
                                src={getVideoPath(asset)}
                                playsInline
                                preload="metadata"
                                crossOrigin="anonymous"
                            />
                            {isVideoLoading && (
                                <Box 
                                    display="flex" 
                                    justifyContent="center" 
                                    alignItems="center"
                                    height="50vh"
                                >
                                    <CircularProgress />
                                </Box>
                            )}
                            {videoError && (
                                <Box 
                                    display="flex" 
                                    flexDirection="column"
                                    justifyContent="center" 
                                    alignItems="center"
                                    height="50vh"
                                    gap={2}
                                >
                                    <Typography color="error">
                                        Failed to load video (Error {videoError.code})
                                    </Typography>
                                    <Button 
                                        variant="contained" 
                                        onClick={() => {
                                            setIsVideoLoading(true);
                                            setVideoError(null);
                                        }}
                                    >
                                        Retry
                                    </Button>
                                </Box>
                            )}
                        </Box>

                        {/* Metadata Panel */}
                        <Box sx={{
                            flex: '0 0 15%', // Reduced to 15% fixed width
                            minWidth: '180px', // Ensure minimum readable width
                            bgcolor: 'background.paper',
                            borderRadius: 2,
                            p: 2,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between'
                        }}>
                            <AIProcessingPanel 
                                asset={asset} 
                                onStartProcessing={handleStartProcessing}
                            />
                            {/* Metadata List */}
                            <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1.5,
                                overflow: 'auto',
                                flex: '1 1 auto'
                            }}>
                                {getDisplayMetadata(asset).map((item, index) => (
                                    <Box key={index} sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 0.25
                                    }}>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                fontSize: '0.7rem',
                                                color: 'text.secondary',
                                                fontWeight: 500
                                            }}
                                        >
                                            {item.label}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontSize: '0.75rem',
                                                color: 'text.primary',
                                                fontWeight: 400
                                            }}
                                        >
                                            {item.value}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>

                            {/* File Location Section */}
                            <Box sx={{
                                mt: 1.5,
                                pt: 1.5,
                                borderTop: '1px solid',
                                borderColor: 'divider',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1,
                                position: 'relative'
                            }}>
                                <Button
                                    onClick={() => setShowPath(!showPath)}
                                    variant="outlined"
                                    size="small"
                                    sx={{
                                        fontSize: '0.65rem',
                                        width: '100%'
                                    }}
                                >
                                    {showPath ? 'Hide file path' : 'Show file path'}
                                </Button>

                                {/* Tooltip with Copy Feature */}
                                {showPath && (
                                    <Box sx={{
                                        position: 'absolute',
                                        bottom: '100%',
                                        left: 0,
                                        right: 0,
                                        bgcolor: 'background.paper',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        p: 1,
                                        mb: 1,
                                        boxShadow: 4,
                                        zIndex: 10,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 0.5
                                    }}>
                                        {/* Path Display */}
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                fontSize: '0.6rem',
                                                color: 'text.primary',
                                                wordBreak: 'break-all',
                                                pr: 3,
                                                opacity: 0.85,
                                                whiteSpace: 'pre-wrap'  // Allow line breaks for long paths
                                            }}
                                        >
                                            {formatFilePath(asset.file_path)}
                                        </Typography>

                                        {/* Copy Button */}
                                        <Button
                                            onClick={() => handleCopy(formatFilePath(asset.file_path))}
                                            variant="text"
                                            size="small"
                                            color={copied ? "success" : "primary"}
                                            sx={{
                                                fontSize: '0.65rem',
                                                minWidth: 'auto',
                                                alignSelf: 'flex-start',
                                                p: '2px 6px'
                                            }}
                                        >
                                            {copied ? '✓ Copied' : 'Copy path'}
                                        </Button>
                                    </Box>
                                )}

                                {/* Open Folder Button */}
                                <Button
                                    onClick={handleOpenFolder}
                                    variant="outlined"
                                    size="small"
                                    sx={{
                                        fontSize: '0.65rem',
                                        width: '100%'
                                    }}
                                >
                                    Open
                                </Button>
                            </Box>
                        </Box>
                    </Box>
                </Box>

                {/* Add visualization panel under the video */}
                <Box sx={{ 
                    maxWidth: '1400px',
                    margin: '0 auto',
                    padding: 2
                }}>
                    <AIVisualizationPanel asset={asset} />
                </Box>

                <Box sx={{ 
                    maxWidth: '1400px',
                    margin: '0 auto',
                    padding: 2
                }}>
                    <ValidationPanel 
                        detections={asset?.media_metadata?.ai_metadata?.validation_results || {}} 
                        onValidate={(type, index, isValid) => {
                            // TODO: Implement validation logic
                            console.log('Validation:', type, index, isValid);
                        }} 
                    />
                </Box>
            </Box>
        </AssetDetailsErrorBoundary>
    );
};

export default AssetDetails; 