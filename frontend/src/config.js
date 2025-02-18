/**
 * @file: config.js
 * @description: Centralized configuration for the Media Asset Manager
 */

// API Configuration
const api = {
    baseURL: 'http://localhost:5001/api/v1',  // Base URL without trailing slash
    endpoints: {
        assets: 'assets',  // Removed leading slash
        media: 'media',
        health: '/health/status',  // Added leading slash to fix URL formatting
        scan: 'scan',
        thumbnails: 'thumbnails',  // Removed leading slashes from all endpoints
        process: 'process'  // Add process endpoint
    },
    ws: {
        endpoint: 'socket.io',  // Socket.IO default path
        protocol: 'socket.io',
        heartbeatInterval: 30000,
        reconnectAttempts: 5
    }
};

// Media Root Path
const mediaRoot = '/Users/rjpaganini/Library/CloudStorage/GoogleDrive-rjpaganini@gmail.com/My Drive/Business/Valen Media/valn.io/exploration/valn.io/Data/Raw_Videos';

// Supported Media Extensions
const supportedExtensions = {
    images: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    videos: ['.mp4', '.webm', '.mov'],
    audio: ['.mp3', '.wav', '.ogg']
};

export default {
    api,
    supportedExtensions,
    mediaRoot
}; 