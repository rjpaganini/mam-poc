/**
 * @file: config.js
 * @description: Centralized configuration for the Media Asset Manager
 */

// API Configuration
const api = {
    baseURL: 'http://localhost:5001/api/v1',
    endpoints: {
        assets: '/assets',
        media: '/media',
        health: '/health/status',
        scan: '/scan',
        thumbnails: '/thumbnails'  // Add explicit thumbnails endpoint
    },
    ws: {
        endpoint: '/socket.io',  // Socket.IO default path
        protocol: 'socket.io',
        heartbeatInterval: 30000,
        reconnectAttempts: 5
    }
};

// Supported Media Extensions
const supportedExtensions = {
    images: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    videos: ['.mp4', '.webm', '.mov'],
    audio: ['.mp3', '.wav', '.ogg']
};

export default {
    api,
    supportedExtensions
}; 