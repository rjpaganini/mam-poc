// Centralized logging service with error tracking and performance monitoring
import config from '../config';

// Log levels with numeric values for filtering
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    FATAL: 4
};

class Logger {
    constructor() {
        // Initialize log buffer and settings
        this.logBuffer = [];
        this.MAX_BUFFER_SIZE = 100;
        this.level = process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;
        this.metrics = new Map();
        
        // Initialize performance monitoring
        if (typeof window !== 'undefined') {
            this.observer = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    this.metrics.set(entry.name, entry.duration);
                });
            });
            this.observer.observe({ entryTypes: ['resource', 'navigation', 'longtask'] });
        }
    }

    // Format log message with timestamp and metadata
    formatMessage(level, message, meta = {}) {
        return {
            timestamp: new Date().toISOString(),
            level,
            message,
            meta: {
                ...meta,
                url: typeof window !== 'undefined' ? window.location.href : '',
                userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : ''
            }
        };
    }

    // Buffer log and send to backend if buffer is full
    async bufferLog(level, message, meta = {}) {
        const logEntry = this.formatMessage(level, message, meta);
        this.logBuffer.push(logEntry);

        if (this.logBuffer.length >= this.MAX_BUFFER_SIZE) {
            await this.flushLogs();
        }
    }

    // Send buffered logs to backend with retry mechanism
    async flushLogs() {
        if (this.logBuffer.length === 0) return;

        // Declare logsToSend outside try block to make it accessible in catch
        const logsToSend = [...this.logBuffer];
        this.logBuffer = []; // Clear buffer

        try {
            const response = await fetch(`${config.api.baseURL}/api/v1/logs`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Client-Version': process.env.REACT_APP_VERSION || 'unknown'
                },
                body: JSON.stringify({ logs: logsToSend })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            // Re-add logs to buffer if send fails
            this.logBuffer.unshift(...logsToSend);
            
            // Log to console as fallback
            console.error('Failed to send logs to server:', error);
            
            // Implement retry with exponential backoff if buffer is getting full
            if (this.logBuffer.length >= this.MAX_BUFFER_SIZE * 0.8) {
                setTimeout(() => this.flushLogs(), 5000);
            }
        }
    }

    // Log methods with appropriate levels
    debug(message, meta = {}) {
        if (this.level <= LOG_LEVELS.DEBUG) {
            this.bufferLog('DEBUG', message, meta);
        }
    }

    info(message, meta = {}) {
        if (this.level <= LOG_LEVELS.INFO) {
            this.bufferLog('INFO', message, meta);
        }
    }

    warn(message, meta = {}) {
        if (this.level <= LOG_LEVELS.WARN) {
            this.bufferLog('WARN', message, meta);
        }
    }

    error(message, error, meta = {}) {
        if (this.level <= LOG_LEVELS.ERROR) {
            this.bufferLog('ERROR', message, {
                ...meta,
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                    code: error.code
                }
            });
        }
    }

    fatal(message, error, meta = {}) {
        if (this.level <= LOG_LEVELS.FATAL) {
            this.bufferLog('FATAL', message, {
                ...meta,
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                    code: error.code
                }
            });
        }
    }

    // Performance monitoring methods
    startTimer(label) {
        if (typeof performance !== 'undefined') {
            performance.mark(`${label}-start`);
        }
    }

    endTimer(label) {
        if (typeof performance !== 'undefined') {
            performance.mark(`${label}-end`);
            performance.measure(label, `${label}-start`, `${label}-end`);
            const duration = this.metrics.get(label);
            this.debug(`Timer ${label} completed`, { duration });
        }
    }

    // Get all collected metrics
    getMetrics() {
        return Object.fromEntries(this.metrics);
    }
}

// Create singleton instance
const logger = new Logger();

// Automatically flush logs before page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        logger.flushLogs();
    });
}

export default logger; 