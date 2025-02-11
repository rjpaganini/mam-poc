/**
 * Socket.IO service for real-time updates
 */
import { io } from 'socket.io-client';
import config from '../config';
import logger from './logger';

class SocketService {
    constructor() {
        this.socket = null;
        this.listeners = new Map();
        this.options = {
            path: config.api.ws.endpoint,  // Use configured Socket.IO path
            reconnection: true,
            reconnectionAttempts: config.api.ws.reconnectAttempts,
            reconnectionDelay: 1000,
            transports: ['websocket'],
            autoConnect: false
        };
    }

    connect() {
        if (this.socket) return;

        try {
            // Extract base URL without /api/v1
            const baseURL = config.api.baseURL.split('/api/v1')[0];
            this.socket = io(baseURL, this.options);

            this.socket.on('connect', () => {
                logger.info('Socket.IO connected successfully');
                this.notifyListeners('status', { connected: true });
            });

            this.socket.on('disconnect', () => {
                logger.info('Socket.IO disconnected');
                this.notifyListeners('status', { connected: false });
            });

            this.socket.on('status_update', (data) => {
                logger.debug('Status update received:', data);
                this.notifyListeners('status', data);
            });

            this.socket.on('status_error', (data) => {
                logger.error('Status error received:', data);
                this.notifyListeners('error', data);
            });

            this.socket.on('connect_error', (error) => {
                logger.error('Socket.IO connection error:', error);
                this.notifyListeners('error', { message: 'Connection failed', error });
            });

            // Actually connect
            this.socket.connect();
        } catch (error) {
            logger.error('Failed to initialize Socket.IO:', error);
            this.notifyListeners('error', { message: 'Failed to initialize Socket.IO', error });
        }
    }

    disconnect() {
        if (!this.socket) return;
        this.socket.disconnect();
        this.socket = null;
    }

    isConnected() {
        return this.socket?.connected || false;
    }

    addListener(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    removeListener(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }

    notifyListeners(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    logger.error(`Error in Socket.IO listener for ${event}:`, error);
                }
            });
        }
    }
}

// Export singleton instance
const socketService = new SocketService();
export default socketService; 