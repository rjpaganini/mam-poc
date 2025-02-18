/**
 * Enhanced logger with WebSocket support and electron-log integration
 * Handles both development and production logging
 */

// Check if electron-log is available through preload script
const electronLog = window.electronLog;

// Simple console logger that works without dependencies
const consoleLogger = {
    debug: electronLog?.debug || console.debug.bind(console),
    info: electronLog?.info || console.info.bind(console),
    warn: electronLog?.warn || console.warn.bind(console),
    error: electronLog?.error || console.error.bind(console)
};

// Format log message with timestamp and level
const formatLog = (level, message, ...args) => {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message} ${args.length ? JSON.stringify(args) : ''}`;
};

// Main logger instance with enhanced features
const logger = {
    ...consoleLogger,

    // Method to inject WebSocket service
    setWebSocketService: (service) => {
        if (!service) return;

        // Override logging methods to also send to WebSocket
        logger.debug = (message, ...args) => {
            const formattedMessage = formatLog('debug', message, ...args);
            electronLog?.debug(formattedMessage) || consoleLogger.debug(formattedMessage);
            service?.send?.({ 
                type: 'log', 
                level: 'debug', 
                message: formattedMessage 
            });
        };

        logger.info = (message, ...args) => {
            const formattedMessage = formatLog('info', message, ...args);
            electronLog?.info(formattedMessage) || consoleLogger.info(formattedMessage);
            service?.send?.({ 
                type: 'log', 
                level: 'info', 
                message: formattedMessage 
            });
        };

        logger.warn = (message, ...args) => {
            const formattedMessage = formatLog('warn', message, ...args);
            electronLog?.warn(formattedMessage) || consoleLogger.warn(formattedMessage);
            service?.send?.({ 
                type: 'log', 
                level: 'warn', 
                message: formattedMessage 
            });
        };

        logger.error = (message, ...args) => {
            const formattedMessage = formatLog('error', message, ...args);
            electronLog?.error(formattedMessage) || consoleLogger.error(formattedMessage);
            service?.send?.({ 
                type: 'log', 
                level: 'error', 
                message: formattedMessage,
                stack: new Error().stack
            });
        };
    }
};

export default logger; 