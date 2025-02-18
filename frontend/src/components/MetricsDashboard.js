/**
 * @file MetricsDashboard.js
 * @description AWS Metrics Dashboard Component
 * 
 * Displays real-time AWS service metrics including:
 * - Service usage statistics
 * - Lambda function performance
 * - Cost tracking and estimates
 * - Free tier limits
 */

import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    CircularProgress,
    Card,
    CardContent,
    Tooltip,
    IconButton,
    Alert,
    Button,
    Menu,
    MenuItem,
    ButtonGroup
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
    AreaChart,
    Area,
    ComposedChart,
    Scatter
} from 'recharts';
import config from '../config';
import logger from '../services/logger';

// Color palette for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

// Custom tooltip component for better data display
const CustomTooltip = ({ active, payload, label, valuePrefix = '', valueSuffix = '' }) => {
    if (active && payload && payload.length) {
        return (
            <Box sx={{ bgcolor: 'background.paper', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {label}
                </Typography>
                {payload.map((entry, index) => (
                    <Typography key={index} variant="body2" sx={{ color: entry.color }}>
                        {entry.name}: {valuePrefix}{entry.value.toLocaleString()}{valueSuffix}
                    </Typography>
                ))}
            </Box>
        );
    }
    return null;
};

const MetricsDashboard = () => {
    // State management
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [metrics, setMetrics] = useState({
        usage: [],
        lambda: [],
        costs: []
    });
    const [refreshing, setRefreshing] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [timeRange, setTimeRange] = useState('24h');
    const [selectedService, setSelectedService] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [detailedMetrics, setDetailedMetrics] = useState({
        lambda: [],
        s3: []
    });

    // Fetch metrics from backend
    const fetchMetrics = async () => {
        try {
            setRefreshing(true);
            setError(null);

            // Convert timeRange to hours/days
            const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720;
            const days = Math.ceil(hours / 24);

            // Fetch all metrics in parallel
            const [
                usageRes,
                lambdaRes,
                s3Res,
                costsRes,
                alertsRes
            ] = await Promise.all([
                fetch(`${config.api.baseURL}/metrics/usage?days=${days}`),
                fetch(`${config.api.baseURL}/metrics/lambda?hours=${hours}`),
                fetch(`${config.api.baseURL}/metrics/s3?hours=${hours}`),
                fetch(`${config.api.baseURL}/metrics/costs?days=${days}`),
                fetch(`${config.api.baseURL}/metrics/alerts?hours=${hours}`)
            ]);

            // Check for errors
            if (!usageRes.ok || !lambdaRes.ok || !s3Res.ok || !costsRes.ok || !alertsRes.ok) {
                throw new Error('Failed to fetch metrics');
            }

            // Parse responses
            const usage = await usageRes.json();
            const lambda = await lambdaRes.json();
            const s3 = await s3Res.json();
            const costs = await costsRes.json();
            const alerts = await alertsRes.json();

            // Update state
            setMetrics({
                usage: usage.data,
                lambda: lambda.data,
                costs: costs.data
            });
            setDetailedMetrics({
                lambda: lambda.data,
                s3: s3.data
            });
            setAlerts(alerts.data);

            logger.info('Metrics updated successfully');
        } catch (err) {
            logger.error('Failed to fetch metrics:', err);
            setError('Failed to fetch metrics. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Export metrics data
    const exportMetrics = (format) => {
        setMenuAnchor(null);
        const data = {
            timestamp: new Date().toISOString(),
            metrics: metrics
        };

        let content;
        let filename;
        let type;

        switch (format) {
            case 'json':
                content = JSON.stringify(data, null, 2);
                filename = 'aws-metrics.json';
                type = 'application/json';
                break;
            case 'csv':
                // Convert to CSV format
                const csvRows = [
                    ['Service', 'Usage', 'Cost'],
                    ...metrics.usage.map(m => [m.service, m.total_usage, metrics.costs.find(c => c.service === m.service)?.total_cost || 0])
                ];
                content = csvRows.map(row => row.join(',')).join('\n');
                filename = 'aws-metrics.csv';
                type = 'text/csv';
                break;
            default:
                return;
        }

        // Create and trigger download
        const blob = new Blob([content], { type });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    };

    // Initial load
    useEffect(() => {
        fetchMetrics();
        // Set up auto-refresh every 5 minutes
        const interval = setInterval(fetchMetrics, 300000);
        return () => clearInterval(interval);
    }, []);

    // Service Usage Chart
    const ServiceUsageChart = () => (
        <Card sx={{ height: '100%' }}>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" gutterBottom>
                        Service Usage
                    </Typography>
                    <Box>
                        <Tooltip title="Refresh">
                            <IconButton onClick={fetchMetrics} disabled={refreshing}>
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Export">
                            <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
                                <MoreVertIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics.usage}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="service" />
                        <YAxis />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="total_usage" fill="#0088FE" name="Total Usage" />
                        <Bar dataKey="operation_count" fill="#00C49F" name="Operation Count" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );

    // Lambda Performance Chart
    const LambdaPerformanceChart = () => (
        <Card sx={{ height: '100%' }}>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Lambda Performance
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={metrics.lambda}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="function_name" />
                        <YAxis yAxisId="left" orientation="left" stroke="#0088FE" />
                        <YAxis yAxisId="right" orientation="right" stroke="#00C49F" />
                        <RechartsTooltip content={<CustomTooltip valueSuffix=" ms" />} />
                        <Legend />
                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="avg_duration_ms"
                            stroke="#0088FE"
                            name="Avg Duration (ms)"
                        />
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="avg_memory_mb"
                            stroke="#00C49F"
                            name="Avg Memory (MB)"
                        />
                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="error_count"
                            stroke="#FF8042"
                            name="Errors"
                        />
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );

    // Cost Breakdown Chart
    const CostBreakdownChart = () => (
        <Card sx={{ height: '100%' }}>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Cost Breakdown
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={metrics.costs}
                            dataKey="total_cost"
                            nameKey="service"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ name, value }) => `${name}: $${value.toFixed(2)}`}
                        >
                            {metrics.costs.map((entry, index) => (
                                <Cell key={entry.service} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <RechartsTooltip content={<CustomTooltip valuePrefix="$" />} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );

    // Free Tier Status
    const FreeTierStatus = () => {
        const getUsagePercentage = (service) => {
            const usage = metrics.usage.find(u => u.service === service);
            if (!usage) return 0;
            
            // Free tier limits
            const limits = {
                lambda: 1000000,  // 1M requests
                s3: 5120,        // 5GB
                rekognition: 1000 // 1000 images
            };
            
            return (usage.total_usage / limits[service]) * 100;
        };

        return (
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Free Tier Status
                    </Typography>
                    <Grid container spacing={2}>
                        {['lambda', 's3', 'rekognition'].map(service => (
                            <Grid item xs={4} key={service}>
                                <Tooltip 
                                    title={`${service.toUpperCase()} Usage: ${getUsagePercentage(service).toFixed(1)}% of Free Tier`}
                                    arrow
                                >
                                    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                                        <CircularProgress
                                            variant="determinate"
                                            value={getUsagePercentage(service)}
                                            size={80}
                                            sx={{
                                                color: theme => getUsagePercentage(service) > 80 
                                                    ? theme.palette.error.main 
                                                    : getUsagePercentage(service) > 60
                                                        ? theme.palette.warning.main
                                                        : theme.palette.success.main
                                            }}
                                        />
                                        <Box
                                            sx={{
                                                top: 0,
                                                left: 0,
                                                bottom: 0,
                                                right: 0,
                                                position: 'absolute',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <Typography variant="caption" component="div">
                                                {`${Math.round(getUsagePercentage(service))}%`}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Tooltip>
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                    {service.toUpperCase()}
                                </Typography>
                            </Grid>
                        ))}
                    </Grid>
                </CardContent>
            </Card>
        );
    };

    // Time Series Chart
    const TimeSeriesChart = ({ data, title }) => (
        <Card sx={{ height: '100%' }}>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    {title}
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timestamp" />
                        <YAxis />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Legend />
                        <Area
                            type="monotone"
                            dataKey="value"
                            fill="#8884d8"
                            stroke="#8884d8"
                            name="Value"
                        />
                        {data.some(d => d.threshold) && (
                            <Line
                                type="monotone"
                                dataKey="threshold"
                                stroke="#ff7300"
                                name="Threshold"
                            />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );

    // Alerts Panel
    const AlertsPanel = () => (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Active Alerts
                </Typography>
                <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {alerts.map((alert, index) => (
                        <Alert
                            key={index}
                            severity={
                                alert.value > alert.threshold * 1.5
                                    ? 'error'
                                    : alert.value > alert.threshold * 1.2
                                    ? 'warning'
                                    : 'info'
                            }
                            sx={{ mb: 1 }}
                        >
                            <Typography variant="subtitle2">
                                {alert.service.toUpperCase()} - {alert.alert_type}
                            </Typography>
                            <Typography variant="body2">
                                Current: {alert.value.toFixed(2)} (Threshold: {alert.threshold.toFixed(2)})
                            </Typography>
                        </Alert>
                    ))}
                    {alerts.length === 0 && (
                        <Typography variant="body2" color="text.secondary">
                            No active alerts
                        </Typography>
                    )}
                </Box>
            </CardContent>
        </Card>
    );

    // Time Range Selector
    const TimeRangeSelector = () => (
        <Box sx={{ mb: 3 }}>
            <ButtonGroup size="small">
                {[
                    { label: '24h', value: '24h' },
                    { label: '7d', value: '7d' },
                    { label: '30d', value: '30d' }
                ].map(range => (
                    <Button
                        key={range.value}
                        variant={timeRange === range.value ? 'contained' : 'outlined'}
                        onClick={() => setTimeRange(range.value)}
                    >
                        {range.label}
                    </Button>
                ))}
            </ButtonGroup>
        </Box>
    );

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}
            
            <TimeRangeSelector />
            
            <Grid container spacing={3}>
                {/* Alerts Panel */}
                <Grid item xs={12}>
                    <AlertsPanel />
                </Grid>
                
                {/* Free Tier Status */}
                <Grid item xs={12}>
                    <FreeTierStatus />
                </Grid>
                
                {/* Service Usage */}
                <Grid item xs={12} md={6}>
                    <ServiceUsageChart />
                </Grid>
                
                {/* Lambda Performance */}
                <Grid item xs={12} md={6}>
                    <LambdaPerformanceChart />
                </Grid>

                {/* Detailed Lambda Metrics */}
                {detailedMetrics.lambda.map((fn, index) => (
                    <Grid item xs={12} key={fn.function_name}>
                        <TimeSeriesChart
                            data={JSON.parse(fn.metrics.Duration.time_series)}
                            title={`${fn.function_name} Duration`}
                        />
                    </Grid>
                ))}

                {/* Detailed S3 Metrics */}
                {detailedMetrics.s3.map((bucket, index) => (
                    <Grid item xs={12} md={6} key={bucket.bucket_name}>
                        <TimeSeriesChart
                            data={JSON.parse(bucket.metrics.BytesUploaded.time_series)}
                            title={`${bucket.bucket_name} Upload Volume`}
                        />
                    </Grid>
                ))}
                
                {/* Cost Breakdown */}
                <Grid item xs={12}>
                    <CostBreakdownChart />
                </Grid>
            </Grid>

            {/* Export Menu */}
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
            >
                <MenuItem onClick={() => exportMetrics('json')}>Export as JSON</MenuItem>
                <MenuItem onClick={() => exportMetrics('csv')}>Export as CSV</MenuItem>
            </Menu>
        </Box>
    );
};

export default MetricsDashboard; 