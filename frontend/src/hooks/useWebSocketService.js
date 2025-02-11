/**
 * React hook for Socket.IO integration
 * Provides real-time functionality with connection state management
 */

import { useEffect, useState, useCallback } from 'react';
import socketService from '../services/socket';
import logger from '../services/logger';

export function useWebSocketService({ 
    onMessage, 
    onError, 
    onConnectionChange,
    autoConnect = true 
}) {
    const [isConnected, setIsConnected] = useState(false);

    // Handle connection status changes
    const handleConnectionChange = useCallback((status) => {
        const connected = status?.connected ?? false;
        setIsConnected(connected);
        if (onConnectionChange) {
            onConnectionChange(connected);
        }
    }, [onConnectionChange]);

    // Memoized message handler
    const handleMessage = useCallback((message) => {
        try {
            if (onMessage) {
                onMessage(message);
            }
        } catch (error) {
            logger.error('Error in Socket.IO message handler:', error);
            if (onError) {
                onError(error);
            }
        }
    }, [onMessage, onError]);

    // Handle errors
    const handleError = useCallback((error) => {
        logger.error('Socket.IO error:', error);
        if (onError) {
            onError(error);
        }
    }, [onError]);

    useEffect(() => {
        // Add listeners for status updates and errors
        socketService.addListener('status', handleConnectionChange);
        socketService.addListener('message', handleMessage);
        socketService.addListener('error', handleError);

        // Connect if autoConnect is true
        if (autoConnect) {
            socketService.connect();
        }

        // Set initial connection state
        setIsConnected(socketService.isConnected());

        // Cleanup listeners
        return () => {
            socketService.removeListener('status', handleConnectionChange);
            socketService.removeListener('message', handleMessage);
            socketService.removeListener('error', handleError);
        };
    }, [handleConnectionChange, handleMessage, handleError, autoConnect]);

    // Memoized connect function
    const connect = useCallback(() => {
        socketService.connect();
    }, []);

    // Memoized disconnect function
    const disconnect = useCallback(() => {
        socketService.disconnect();
    }, []);

    // Memoized send function
    const send = useCallback((message) => {
        try {
            if (socketService.socket) {
                socketService.socket.emit('message', message);
            } else {
                throw new Error('Socket.IO not connected');
            }
        } catch (error) {
            logger.error('Error sending Socket.IO message:', error);
            if (onError) {
                onError(error);
            }
        }
    }, [onError]);

    return {
        isConnected,
        connect,
        disconnect,
        send
    };
}

export { useWebSocketService as useWebSocket }; 