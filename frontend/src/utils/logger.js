// Custom logger configuration with enhanced WebSocket handling
const FILTERED_PATTERNS = [
    '[webpack-dev-server]',
    'Invalid Host/Origin header',
    'The development server has disconnected',
    'Live Reload enabled'
];

const shouldFilter = (message) => {
    if (typeof message !== 'string') return false;
    return FILTERED_PATTERNS.some(pattern => message.includes(pattern));
};

const logger = {
    info: (message, ...args) => {
        if (shouldFilter(message)) return;
        console.info(message, ...args);
    },
    warn: (message, ...args) => {
        if (shouldFilter(message)) return;
        console.warn(message, ...args);
    },
    error: (message, ...args) => {
        // Only filter specific WebSocket-related errors
        if (shouldFilter(message) && 
            (message.includes('WebSocket') || message.includes('webpack-dev-server'))) {
            return;
        }
        console.error(message, ...args);
    },
    debug: (...args) => {
        if (process.env.NODE_ENV === 'development') {
            const shouldLog = args.every(arg => !shouldFilter(arg));
            if (shouldLog) {
                console.debug(...args);
            }
        }
    },
    // New method for development-only logging
    dev: (message, ...args) => {
        if (process.env.NODE_ENV === 'development' && !shouldFilter(message)) {
            console.log(`[DEV] ${message}`, ...args);
        }
    }
};

// Enhanced error handling for development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    // Store original console methods
    const originalConsole = {
        error: console.error,
        warn: console.warn,
        log: console.log
    };

    // Override console.error
    console.error = (...args) => {
        if (args[0] && shouldFilter(args[0])) {
            // Log filtered messages at debug level if explicitly enabled
            if (localStorage.getItem('DEBUG_WDS') === 'true') {
                originalConsole.log('[Filtered Error]', ...args);
            }
            return;
        }
        originalConsole.error.apply(console, args);
    };

    // Override console.warn
    console.warn = (...args) => {
        if (args[0] && shouldFilter(args[0])) {
            // Log filtered warnings at debug level if explicitly enabled
            if (localStorage.getItem('DEBUG_WDS') === 'true') {
                originalConsole.log('[Filtered Warning]', ...args);
            }
            return;
        }
        originalConsole.warn.apply(console, args);
    };

    // Add window error handler
    window.addEventListener('error', (event) => {
        if (event && shouldFilter(event.message)) {
            event.preventDefault();
            return;
        }
    });

    // Add unhandled rejection handler
    window.addEventListener('unhandledrejection', (event) => {
        if (event && event.reason && shouldFilter(event.reason.message)) {
            event.preventDefault();
            return;
        }
    });
}

export default logger; 