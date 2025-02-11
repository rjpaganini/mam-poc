/**
 * Enhanced logger with WebSocket support and file output
 * Handles both development and production logging
 */

// Simple console logger that works without dependencies
const consoleLogger = {
    debug: console.debug.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
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
            consoleLogger.debug(formattedMessage);
            service?.send?.({ 
                type: 'log', 
                level: 'debug', 
                message: formattedMessage 
            });
        };

        logger.info = (message, ...args) => {
            const formattedMessage = formatLog('info', message, ...args);
            consoleLogger.info(formattedMessage);
            service?.send?.({ 
                type: 'log', 
                level: 'info', 
                message: formattedMessage 
            });
        };

        logger.warn = (message, ...args) => {
            const formattedMessage = formatLog('warn', message, ...args);
            consoleLogger.warn(formattedMessage);
            service?.send?.({ 
                type: 'log', 
                level: 'warn', 
                message: formattedMessage 
            });
        };

        logger.error = (message, ...args) => {
            const formattedMessage = formatLog('error', message, ...args);
            consoleLogger.error(formattedMessage);
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