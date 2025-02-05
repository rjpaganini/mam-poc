// frontend/src/services/api.js
// Centralized API service with retry logic and error handling

import axios from 'axios';
import config from '../config';

// Retry delay calculation with exponential backoff
const getRetryDelay = (retryCount) => Math.min(1000 * (2 ** retryCount), 10000);

// Try to connect to different ports
const tryPorts = async (ports) => {
    const errors = [];
    
    // Try only port 5001 with correct health endpoint
    try {
        const response = await fetch(`http://localhost:5001/api/v1/health/status`);
        if (response.ok) {
            console.log('Successfully connected to backend on port 5001');
            return 5001;
        }
    } catch (error) {
        console.warn('Failed to connect to backend:', error);
        errors.push(`Port 5001: ${error.message}`);
    }
    
    throw new Error(`Could not connect to backend. Attempts:\n${errors.join('\n')}`);
};

// Create axios instance with enhanced configuration
const createAPI = async () => {
    try {
        // Try common development ports
        const port = await tryPorts([5001, 5002]);  // Updated to try both ports
        
        const api = axios.create({
            baseURL: `http://localhost:${port}`,
            timeout: config.api.timeout || 30000,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            validateStatus: status => status >= 200 && status < 500
        });

        // Request interceptor for logging
        api.interceptors.request.use(config => {
            console.debug(`API Request: ${config.method.toUpperCase()} ${config.url}`);
            return config;
        }, error => {
            console.error('Request error:', error);
            return Promise.reject(error);
        });

        // Response interceptor with retry logic
        api.interceptors.response.use(
            response => response.data,
            async error => {
                const { config, response } = error;
                
                // Log detailed error information
                console.error('API Error:', {
                    url: config?.url,
                    method: config?.method,
                    status: response?.status,
                    data: response?.data,
                    error: error.message
                });
                
                // Skip retry for specific status codes
                if (response && [400, 401, 403, 404].includes(response.status)) {
                    return Promise.reject(error);
                }
                
                // Initialize retry count
                config.retryCount = config.retryCount || 0;
                
                // Check if we should retry
                if (config.retryCount >= 3) {
                    return Promise.reject(error);
                }
                
                config.retryCount += 1;
                
                // Calculate delay
                const delay = getRetryDelay(config.retryCount);
                console.warn(`Retrying request (${config.retryCount}/3) after ${delay}ms`);
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, delay));
                
                // Retry request
                return api(config);
            }
        );

        return api;
    } catch (error) {
        console.error('API creation failed:', error);
        throw error;
    }
};

// Initialize API instance
let apiInstance = null;

const getAPI = async () => {
    if (!apiInstance) {
        apiInstance = await createAPI();
    }
    return apiInstance;
};

// API endpoints with enhanced error handling
export const assetsApi = {
    search: async (query) => {
        const api = await getAPI();
        try {
            return await api.get(`/assets?query=${encodeURIComponent(query)}`);
        } catch (error) {
            console.error('Search failed:', error);
            throw new Error('Failed to search assets');
        }
    },
    
    getStatus: async () => {
        const api = await getAPI();
        try {
            return await api.get('/health/status');
        } catch (error) {
            console.error('Health check failed:', error);
            throw error;
        }
    },

    loadAssets: async () => {
        const api = await getAPI();
        try {
            return await api.get('/assets');
        } catch (error) {
            console.error('Error fetching assets:', error);
            throw error;
        }
    }
};

export const regenerateThumbnails = async (timestamp = 6) => {
    try {
        // Clear thumbnail cache first
        const { ipcRenderer } = window.require('electron');
        await ipcRenderer.invoke('clear-thumbnail-cache');
        
        // Then regenerate thumbnails with specified timestamp
        const api = await getAPI();
        const response = await api.post('/regenerate-thumbnails', {
            timestamp: timestamp
        });
        
        // Force reload assets to get fresh thumbnails
        const assetsResponse = await assetsApi.loadAssets();
        
        // Verify thumbnails were generated with correct timestamp
        const assets = assetsResponse.data;
        const incorrectTimestamps = assets.filter(
            asset => asset.thumbnail_timestamp !== timestamp
        );
        
        if (incorrectTimestamps.length > 0) {
            console.warn('Some assets have incorrect thumbnail timestamps:', incorrectTimestamps);
        }
        
        return {
            ...response.data,
            assetsVerified: incorrectTimestamps.length === 0
        };
    } catch (error) {
        console.error('Failed to regenerate thumbnails:', error);
        throw error;
    }
};

// Add a new function to force reload an individual asset's thumbnail
export const reloadThumbnail = async (thumbnailUrl) => {
    if (!thumbnailUrl) return;
    
    // Add both timestamp and generation time to URL
    const timestamp = Date.now();
    const separator = thumbnailUrl.includes('?') ? '&' : '?';
    return `${thumbnailUrl}${separator}t=${timestamp}&gen=${timestamp}`;
};

// Add a function to get current thumbnail settings
export const getThumbnailSettings = async () => {
    try {
        const api = await getAPI();
        const response = await api.get('/assets');
        const assets = response.data;
        
        // Get the most common timestamp being used
        const timestampCounts = assets.reduce((acc, asset) => {
            const timestamp = asset.thumbnail_timestamp;
            acc[timestamp] = (acc[timestamp] || 0) + 1;
            return acc;
        }, {});
        
        const currentTimestamp = Object.entries(timestampCounts)
            .sort(([,a], [,b]) => b - a)[0]?.[0] || 6;
            
        return {
            currentTimestamp: Number(currentTimestamp),
            totalAssets: assets.length,
            timestampDistribution: timestampCounts
        };
    } catch (error) {
        console.error('Failed to get thumbnail settings:', error);
        throw error;
    }
};

export default getAPI; 