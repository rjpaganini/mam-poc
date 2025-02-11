/**
 * @file: api.js
 * @description: Simple API service for Media Asset Management
 */

import axios from 'axios';
import config from '../config';
import logger from './logger';

// Create a single axios instance
const api = axios.create({
    baseURL: config.api.baseURL,
    timeout: 10000,
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
});

// Add response interceptor for error handling
api.interceptors.response.use(
    response => response.data,
    error => {
        const { config: reqConfig, response } = error;
        
        logger.error('API Error:', {
            url: reqConfig?.url,
            method: reqConfig?.method,
            status: response?.status,
            data: response?.data,
            error: error.message
        });
        
        return Promise.reject(error);
    }
);

// Add request interceptor to ensure URL construction
api.interceptors.request.use(
    config => {
        // Remove any double slashes in the URL (except after http/https)
        config.url = config.url.replace(/([^:]\/)\/+/g, '$1');
        return config;
    },
    error => {
        return Promise.reject(error);
    }
);

// Simple API endpoints
export const assetsApi = {
    // Get all assets with pagination
    getAssets: async (page = 1, limit = 20) => {
        try {
            const response = await api.get(config.api.endpoints.assets, {
                params: { page, limit }
            });
            return response;
        } catch (error) {
            logger.error('Failed to fetch assets:', error);
            throw error;
        }
    },
    
    // Get single asset
    getAsset: async (id) => {
        try {
            const response = await api.get(`${config.api.endpoints.assets}/${id}`);
            return response;
        } catch (error) {
            logger.error(`Failed to fetch asset ${id}:`, error);
            throw error;
        }
    },
    
    // Get health status
    getHealth: async () => {
        try {
            const response = await api.get(config.api.endpoints.health);
            return response;
        } catch (error) {
            logger.error('Health check failed:', error);
            throw error;
        }
    }
};

// Simple thumbnail management
export const regenerateThumbnails = async () => {
    try {
        const { ipcRenderer } = window.require('electron');
        await ipcRenderer.invoke('clear-thumbnail-cache');
        return await assetsApi.getAssets();
    } catch (error) {
        logger.error('Failed to regenerate thumbnails:', error);
        throw error;
    }
};

export const reloadThumbnail = async (thumbnailUrl) => {
    if (!thumbnailUrl) return thumbnailUrl;
    const timestamp = Date.now();
    const separator = thumbnailUrl.includes('?') ? '&' : '?';
    return `${thumbnailUrl}${separator}t=${timestamp}`;
};

// Add a function to get current thumbnail settings
export const getThumbnailSettings = async () => {
    try {
        const response = await assetsApi.getAssets();
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

// Export the configured API instance
const apiService = api;
export default apiService; 